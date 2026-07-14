/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Notebook {
  id: string;
  name: string;
  description: string;
  createdAt: number;
}

export type NotebookItemType = 'note' | 'command' | 'technique';

export interface NotebookItem {
  id: string;
  notebookId: string;
  type: NotebookItemType;
  title: string;
  content: string; // Explicación, notas, etc.
  syntax?: string; // Para comandos (ej. nmap -sV) o pasos de técnicas
  tags: string[];
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export type QuizQuestionType = 'multiple-choice' | 'active-recall' | 'command-fill';

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  question: string;
  options?: string[]; // Para multiple-choice
  correctAnswer: string; // Respuesta correcta (para comparar o mostrar)
  userAnswer?: string; // Lo que respondió el usuario
  isCorrect?: boolean; // Evaluado
  explanation?: string; // Explicación de por qué es la respuesta correcta
}

export interface Evaluation {
  id: string;
  notebookId: string;
  createdAt: number;
  questions: QuizQuestion[];
  score: number; // Cantidad de correctas
  totalQuestions: number;
  aiAnalysis?: string; // Feedback consolidado de Gemini sobre lo que se debe repasar
}

export interface Vulnerability {
  name: string;
  severity: 'baja' | 'media' | 'alta' | 'crítica';
  description: string;
  remediation?: string;
}

export interface Lab {
  id: string;
  notebookId: string;
  name: string;
  platform: string;
  date: string;
  status: 'en_progreso' | 'completado';
  notes: string;
  vulnerabilities: Vulnerability[];
  createdAt: number;
}

