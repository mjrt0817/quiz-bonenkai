export enum GameState {
  SETUP = 'SETUP',
  LOBBY = 'LOBBY',
  PLAYING_QUESTION = 'PLAYING_QUESTION',
  PLAYING_RESULT = 'PLAYING_RESULT', // Showing correct answer for current question
  FINAL_RESULT = 'FINAL_RESULT',
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  optionImages?: string[]; // Array of image URLs for options (optional)
  questionImage?: string; // Image URL for the question itself (optional)
  correctIndex: number;
  explanation: string;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  lastAnswerIndex: number | null; // -1 for no answer, 0-3 for index
  lastAnswerTime: number; // For tie-breaking
  totalResponseTime?: number; // Total milliseconds taken to answer across all questions
  isOnline?: boolean; // Track connection status roughly
}

export interface HostState {
  gameState: GameState;
  currentQuestionIndex: number;
  questions: QuizQuestion[];
  players: Player[];
  roomCode: string;
  timeLimit: number; // in seconds
  questionStartTime: number | null; // Timestamp when question started
  rankingRevealStage: number; // 0: Show all/lower, 1: Show 3rd, 2: Show 2nd, 3: Show 1st
  isRankingResultVisible: boolean; // Controls whether the current stage result is revealed (true) or hidden/suspense (false)
  hideBelowTop3: boolean; // Option to hide ranks 4 and below
  quizTitle: string; // Tournament Title
  titleImage?: string | null; // Base64 image data for the lobby screen
  isLobbyDetailsVisible: boolean; // Controls if QR/Players are shown in lobby or just the title image
}

export const COLORS = [
  'bg-blue-500 hover:bg-blue-600', // Option 0
  'bg-red-500 hover:bg-red-600',   // Option 1
  'bg-green-500 hover:bg-green-600', // Option 2
  'bg-yellow-500 hover:bg-yellow-600' // Option 3
];

export const BTN_LABELS = ['A', 'B', 'C', 'D'];
