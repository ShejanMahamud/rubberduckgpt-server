export interface IInterviewQuestion {
  id: string;
  sessionId: string;
  category: 'TECHNICAL' | 'PROJECTS' | 'BEHAVIORAL';
  text: string;
  order: number;
  maxScore: number;
}

export interface IInterviewAnswer {
  id: string;
  sessionId: string;
  questionId: string;
  userId: string;
  answerText: string;
  source: 'TEXT' | 'AUDIO';
  score?: number;
  aiFeedback?: string;
  gradedAt?: Date;
  transcriptionMeta?: unknown;
}

export interface IInterviewSession {
  id: string;
  userId: string;
  resumeText: string;
  resumeName: string;
  resumeMime: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  startedAt: Date;
  completedAt?: Date;
  gradedAt?: Date;
  totalScore?: number;
  maxScore?: number;
  questionCount?: number;
}

export interface IInterviewService {
  startInterviewFromResume(file: Express.Multer.File, userId: string): Promise<{
    success: boolean;
    message: string;
    data: { sessionId: string; totalQuestions: number };
  }>;
  
  getNextQuestion(sessionId: string, userId: string): Promise<{
    success: boolean;
    message: string;
    data: any;
  }>;
  
  submitAnswer(sessionId: string, userId: string, body: any): Promise<{
    success: boolean;
    message: string;
    data: { answerId: string };
  }>;
  
  gradeInterview(sessionId: string, userId: string): Promise<{
    success: boolean;
    message: string;
    data: { results: Array<{ answerId: string; questionId: string; score: number; feedback: string }> };
  }>;
}
