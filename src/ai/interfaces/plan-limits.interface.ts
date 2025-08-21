export interface IPlanLimits {
  maxInterviews: number;
  maxChatMessages: number;
  maxResumeUploads: number;
}

export interface ISubscriptionInfo {
  planType: 'FREE' | 'BASIC' | 'PRO';
  isActive: boolean;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
}

export interface ILimitEnforcement {
  enforceInterviewLimit(userId: string): Promise<void>;
  enforceChatLimit(userId: string): Promise<void>;
  enforceResumeUploadLimit(userId: string): Promise<void>;
}
