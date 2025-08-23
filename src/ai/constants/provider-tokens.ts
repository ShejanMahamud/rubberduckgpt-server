export const PROVIDER_TOKENS = {
  GEMINI: 'GEMINI',
  GROQ: 'GROQ',
  GEMINI_CHAT_PROVIDER: 'GEMINI_CHAT_PROVIDER',
  GROQ_AI_PROVIDER: 'GROQ_AI_PROVIDER',
} as const;

export type ProviderToken =
  (typeof PROVIDER_TOKENS)[keyof typeof PROVIDER_TOKENS];
