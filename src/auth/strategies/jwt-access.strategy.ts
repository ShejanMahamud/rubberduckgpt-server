import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IJwtPayload } from 'src/auth/types';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'access') {
  constructor(
    //inject config service
    private config: ConfigService,
  ) {
    //pass env values to parent class
    super({
      //secret key
      secretOrKey: config.get<string>('ACCESS_TOKEN_SECRET') as string,
      //extract jwt from request
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  //validate and return the payload
  validate(payload: IJwtPayload): IJwtPayload {
    return payload;
  }
}
