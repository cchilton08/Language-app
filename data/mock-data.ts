import type { Mistake, QuizResult, VocabularyWord } from "@/types";

export const vocabulary: VocabularyWord[] = [
  { id: "1", dutch: "denken", pronunciation: "DEN-kuhn", english: "to think", mastery: 42, correctCount: 8, incorrectCount: 7, status: "review" },
  { id: "2", dutch: "geven", pronunciation: "GHAY-vuhn", english: "to give", mastery: 55, correctCount: 11, incorrectCount: 6, status: "learning" },
  { id: "3", dutch: "geld", pronunciation: "khelt", english: "money", mastery: 36, correctCount: 5, incorrectCount: 8, status: "review" },
  { id: "4", dutch: "telefoon", pronunciation: "tay-lay-FOHN", english: "telephone", mastery: 68, correctCount: 15, incorrectCount: 5, status: "learning" },
];
export const quizResults: QuizResult[] = [
  { id: "4", lesson: "Lesson 4", score: 82, completedAt: "2026-08-19" },
  { id: "5", lesson: "Lesson 5", score: 76, completedAt: "2026-08-22" },
  { id: "6", lesson: "Lesson 6", score: 70, completedAt: "2026-08-26" },
];
export const mistakes: Mistake[] = [
  { id: "1", incorrect: "Ik ben studeer.", correct: "Ik studeer.", explanation: "Don’t use ‘ben’ before a conjugated verb.", category: "Verb forms" },
  { id: "2", incorrect: "Ik ga naar huis morgen.", correct: "Ik ga morgen naar huis.", explanation: "Time usually comes before place.", category: "Word order" },
];
