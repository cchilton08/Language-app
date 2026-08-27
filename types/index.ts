export interface VocabularyWord { id: string; dutch: string; pronunciation: string; english: string; mastery: number; correctCount: number; incorrectCount: number; status: "strong" | "learning" | "review"; }
export interface ChatMessage { id: string; role: "tutor" | "user"; content: string; translation?: string; createdAt: string; }
export interface Mistake { id: string; incorrect: string; correct: string; explanation: string; category: string; }
export interface QuizResult { id: string; lesson: string; score: number; completedAt: string; }
export interface LearningSession { id: string; durationMinutes: 5 | 10 | 20; startedAt: string; completedAt?: string; messages: ChatMessage[]; }
