import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/prisma/prisma.service';

@WebSocketGateway({
  namespace: 'interview',
  cors: { origin: '*', credentials: true },
})
export class InterviewGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  public server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth as any)?.token ||
      client.handshake.headers['authorization']
        ?.toString()
        .replace(/^Bearer\s+/i, '');
    if (!token) {
      client.emit('error', { message: 'Unauthorized: missing token' });
      return client.disconnect();
    }
    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: process.env.ACCESS_TOKEN_SECRET as string,
      });
      client.data.userId = payload.sub;
    } catch {
      client.emit('error', { message: 'Unauthorized: invalid token' });
      return client.disconnect();
    }
  }

  @SubscribeMessage('joinSession')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    if (!data?.sessionId) return;
    const userId = client.data.userId as string | undefined;
    if (!userId) return client.emit('error', { message: 'Unauthorized' });

    const owns = await this.prisma.interviewSession.findFirst({
      where: { id: data.sessionId, userId },
    });
    if (!owns)
      return client.emit('error', {
        message: 'Forbidden: session not found/owned',
      });

    client.join(data.sessionId);
    client.emit('joined', { sessionId: data.sessionId });

    // Inform participant about current room size
    const sockets = await this.server.in(data.sessionId).fetchSockets();
    client.emit('rtc:room-info', { participants: sockets.length });
    // Notify others that a peer joined
    client.to(data.sessionId).emit('rtc:peer-joined', { socketId: client.id });
  }

  emitToSession(sessionId: string, event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(sessionId).emit(event, payload);
  }

  // WebRTC signaling relay
  @SubscribeMessage('rtc:offer')
  async relayOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; offer: any },
  ) {
    if (!data?.sessionId || !data?.offer) return;
    client
      .to(data.sessionId)
      .emit('rtc:offer', { from: client.id, offer: data.offer });
  }

  @SubscribeMessage('rtc:answer')
  async relayAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; answer: any },
  ) {
    if (!data?.sessionId || !data?.answer) return;
    client
      .to(data.sessionId)
      .emit('rtc:answer', { from: client.id, answer: data.answer });
  }

  @SubscribeMessage('rtc:candidate')
  async relayCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; candidate: any },
  ) {
    if (!data?.sessionId || !data?.candidate) return;
    client
      .to(data.sessionId)
      .emit('rtc:candidate', { from: client.id, candidate: data.candidate });
  }

  handleDisconnect(client: Socket) {
    // Notify peers of departure
    for (const room of client.rooms) {
      if (room === client.id) continue;
      this.server.to(room).emit('rtc:peer-left', { socketId: client.id });
    }
  }
}
