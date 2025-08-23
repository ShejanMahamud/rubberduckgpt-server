export type ChatMessageWithSession = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: Date;
  sessionId: string;
  tokens?: number | null;
};

export type ChatSessionWithMessages = {
  id: string;
  userId: string;
  title?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  model: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  messages?: ChatMessageWithSession[];
  _count?: { messages: number };
};
