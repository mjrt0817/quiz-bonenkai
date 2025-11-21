import React, { useState, useEffect } from 'react';
import { GameState, HostState, Player, BTN_LABELS, COLORS } from '../types';
import { User, Loader, Check, X, Trophy, LogOut, AlertCircle } from 'lucide-react';

interface PlayerScreenProps {
  state: HostState;
  playerId: string;
  onJoin: (name: string) => Promise<boolean>;
  onAnswer: (index: number) => void;
  onBack: () => void;
}

const STORAGE_KEY = 'quiz_player_name';

const PlayerScreen: React.FC<PlayerScreenProps> = ({ state, playerId, onJoin, onAnswer, onBack }) => {
  const [nameInput, setNameInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const currentPlayer = state.players.find(p => p.id === playerId);
  const hasAnswered = currentPlayer?.lastAnswerIndex !== null && currentPlayer?.lastAnswerIndex !== undefined;

  // Auto-fill name and restore session
  useEffect(() => {
    const savedName = localStorage.getItem(STORAGE_KEY);
    if (savedName) {
      setNameInput(savedName);
    }
    // If player exists in the list with my ID, I'm joined.
    if (state.players.find(p => p.id === playerId)) {
        setJoined(true);
    }
  }, [state.players, playerId]);

  // Visual Timer
  useEffect(() => {
    let timerId: any;
    if (state.gameState === GameState.PLAYING_QUESTION && state.questionStartTime) {
      timerId = setInterval(() => {
        const elapsedSeconds = (Date.now() - (state.questionStartTime || 0)) / 1000;
        const remaining = Math.max(0, state.timeLimit - elapsedSeconds);
        setTimeLeft(remaining);
      }, 100);
    } else {
      setTimeLeft(0);
    }
    return () => clearInterval(timerId);
  }, [state.gameState, state.questionStartTime, state.timeLimit]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      setIsJoining(true);
      const nameToSave = nameInput.trim();
      // Join logic is now async to check DB
      const success = await onJoin(nameToSave);
      if (success) {
         localStorage.setItem(STORAGE_KEY, nameToSave);
         setJoined(true);
      }
      setIsJoining(false);
    }
  };

  // If I was kicked, reset joined state
  useEffect(() => {
     if (joined && !currentPlayer && state.players.length > 0) {
        // If players list is populated but I'm not in it, I might have been kicked
        // However, to avoid flickering on initial load, we check length > 0
        setJoined(false); 
     }
  }, [state.players, currentPlayer, joined]);


  // --- 1. SETUP / JOIN SCREEN ---
  if (!joined) {
    return (
      <div className="h-full bg-indigo-600 flex flex-col items-center justify-center p-6 relative">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-slate-800 mb-2">クイズ大会</h1>
            <p className="text-slate-500">名前を入力して参加しよう！</p>
            <p className="text-xs text-slate-400 mt-2">※同じ名前で再開できます</p>
          </div>
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="relative">
               <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
               <input 
                 type="text" 
                 value={nameInput}
                 onChange={(e) => setNameInput(e.target.value)}
                 placeholder="ニックネーム"
                 maxLength={12}
                 className="w-full pl-10 pr-4 py-3 bg-slate-100 border-2 border-transparent focus:bg-white focus:border-indigo-500 rounded-xl outline-none font-bold text-lg transition text-slate-900"
               />
            </div>
            <button 
              type="submit" 
              disabled={!nameInput || isJoining}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-700 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {isJoining ? <Loader className="animate-spin" size={20} /> : '参加する'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- 2. WAITING SCREENS ---
  if (state.gameState === GameState.LOBBY || state.gameState === GameState.SETUP) {
    return (
      <div className="h-full bg-indigo-500 flex flex-col items-center justify-center p-6 text-white text-center relative">
         <Loader className="w-16 h-16 animate-spin mb-6 text-white/80" />
         <h2 className="text-2xl font-bold mb-2">参加完了！</h2>
         <p className="text-indigo-100 text-lg">ホストが開始するのを待っています...</p>
         <div className="mt-8 px-6 py-2 bg-white/20 rounded-full font-mono text-xl font-bold">
           {currentPlayer?.name}
         </div>
      </div>
    );
  }

  // --- 3. PLAYING ---
  if (state.gameState === GameState.PLAYING_QUESTION) {
    if (hasAnswered) {
       return (
         <div className="h-full bg-slate-800 flex flex-col items-center justify-center p-6 text-white">
           <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center mb-6 animate-pulse">
             <Check size={40} />
           </div>
           <h2 className="text-2xl font-bold">回答を送信しました！</h2>
           <p className="text-slate-400 mt-2">結果発表をお待ちください...</p>
         </div>
       );
    }

    return (
      <div className="h-full bg-slate-100 flex flex-col">
         <div className="h-2 bg-slate-200 w-full">
           <div 
             className={`h-full transition-all ease-linear duration-100 ${timeLeft < 5 ? 'bg-red-500' : 'bg-indigo-500'}`}
             style={{ width: `${(timeLeft / state.timeLimit) * 100}%` }}
           />
         </div>

         <div className="bg-white p-6 shadow-sm border-b text-center">
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Q {state.currentQuestionIndex + 1}</span>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{Math.ceil(timeLeft)}秒</span>
            </div>
            <p className="text-slate-800 font-medium truncate opacity-50">画面を見て答えを選んでください</p>
         </div>
         
         <div className="flex-1 p-4 grid grid-cols-2 gap-4 content-center max-w-md mx-auto w-full">
           {COLORS.map((colorClass, idx) => (
             <button
               key={idx}
               onClick={() => onAnswer(idx)}
               className={`h-32 rounded-2xl shadow-lg flex flex-col items-center justify-center text-white active:scale-95 transition-transform ${colorClass}`}
             >
               <span className="text-4xl font-black mb-1">{BTN_LABELS[idx]}</span>
             </button>
           ))}
         </div>
      </div>
    );
  }

  // --- 4. RESULT ---
  if (state.gameState === GameState.PLAYING_RESULT) {
    const currentQ = state.questions[state.currentQuestionIndex];
    const myAnswer = currentPlayer?.lastAnswerIndex;
    const isCorrect = myAnswer === currentQ.correctIndex;
    
    return (
      <div className={`h-full flex flex-col items-center justify-center p-6 text-white transition-colors duration-500 ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
         <div className="bg-white/20 p-8 rounded-full mb-6 backdrop-blur-sm">
           {isCorrect ? <Check size={64} strokeWidth={4} /> : <X size={64} strokeWidth={4} />}
         </div>
         
         <h2 className="text-4xl font-black uppercase mb-2 tracking-wider">
           {isCorrect ? '正解！' : '不正解...'}
         </h2>
         
         <div className="mt-8 bg-black/20 px-8 py-4 rounded-xl text-center backdrop-blur-sm">
           <p className="text-sm uppercase opacity-75 mb-1">現在のスコア</p>
           <p className="text-3xl font-mono font-bold">{currentPlayer?.score}</p>
         </div>
      </div>
    );
  }

  // --- 5. FINAL RANKING ---
  if (state.gameState === GameState.FINAL_RESULT) {
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex(p => p.id === playerId) + 1;

    return (
      <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-white relative">
        <Trophy className="text-yellow-400 w-20 h-20 mb-6" />
        <h2 className="text-3xl font-bold mb-2">クイズ終了！</h2>
        
        <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-xs text-center border border-slate-700 mt-4 shadow-xl">
           <p className="text-slate-400 text-sm uppercase tracking-widest mb-4">あなたの順位</p>
           <div className="text-6xl font-black text-white mb-4">#{rank}</div>
           <div className="h-px bg-slate-700 w-full my-4"></div>
           <p className="text-indigo-400 font-bold text-xl">{currentPlayer?.score} 点</p>
        </div>
      </div>
    );
  }

  return <div>Loading...</div>;
};

export default PlayerScreen;
