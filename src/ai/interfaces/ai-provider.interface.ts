export interface IAiProvider {
  generateQuestions(text: string): Promise<Array<{
    text: string;
    category: 'TECHNICAL' | 'PROJECTS' | 'BEHAVIORAL';
    order: number;
  }>>;
  
  gradeAnswer(question: string, answer: string, maxScore: number): Promise<{
    score: number;
    feedback: string;
  }>;
  
  transcribeAudio(audio: Express.Multer.File): Promise<string>;
}

export interface IChatProvider {
  sendMessage(
    messages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
    prompt: string,
    model: string
  ): Promise<{ text: string; chunks: string[] }>;
}
