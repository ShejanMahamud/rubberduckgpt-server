export interface IChatSession {
  id: string;
  userId: string;
  title: string | null;
  temperature: number | null;
  maxTokens: number | null;
  model: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IChatMessage {
  id: string;
  sessionId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
  tokens?: number | null;
}

export interface IChatService {
  createChatSession(
    userId: string,
    options?: {
      title?: string;
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
    data: IChatSession & { messages: IChatMessage[] };
  }>;

  getChatSessions(userId: string): Promise<{
    success: boolean;
    message: string;
    data: Array<IChatSession & { _count: { messages: number } }>;
  }>;

  getChatSession(
    sessionId: string,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    data: IChatSession & { messages: IChatMessage[] };
  }>;

  chatWithSession(
    sessionId: string,
    userId: string,
    prompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      userMessage: IChatMessage;
      aiMessage: IChatMessage;
      response: string;
      chunks: string[];
    };
  }>;

  deleteChatSession(
    sessionId: string,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    data: null;
  }>;

  updateChatSession(
    sessionId: string,
    userId: string,
    data: {
      title?: string;
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
    data: IChatSession;
  }>;
}
