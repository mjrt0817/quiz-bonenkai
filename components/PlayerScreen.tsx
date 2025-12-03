import React, { useState, useEffect } from 'react';
import { GameState, HostState, Player, BTN_LABELS, COLORS } from '../types';
import { User, Loader, Check, X, Trophy, LogOut, AlertTriangle, Sparkles, Lock, Medal, PartyPopper } from 'lucide-react';

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
  const isFinalQuestion = state.questions.length > 0 && state.currentQuestionIndex === state.questions.length - 1;

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
            <h1 className="text-3xl font-black text-slate-800 mb-2">{state.quizTitle || 'クイズ大会'}</h1>
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

  // --- 3. PLAYING: QUESTION ---
  if (state.gameState === GameState.PLAYING_QUESTION) {
    const currentQuestion = state.questions[state.currentQuestionIndex];

    if (hasAnswered) {
       return (
         <div className="h-full bg-slate-800 flex flex-col items-center justify-center p-6 text-white">
           <div className="w-24 h-24 bg-indigo-500 rounded-full flex items-center justify-center mb-6 animate-bounce-short">
             <Check size={48} />
           </div>
           <h2 className="text-3xl font-bold mb-2">回答を送信しました</h2>
           <p className="text-slate-400">結果発表をお待ちください...</p>
         </div>
       );
    }

    return (
      <div className="h-full bg-slate-900 flex flex-col p-4 pb-8">
        {/* Final Question Banner */}
        {isFinalQuestion && (
          <div className="w-full bg-red-600 text-white text-center font-bold py-3 rounded-xl mb-4 animate-pulse shadow-lg border-2 border-red-400 flex items-center justify-center gap-2">
            <AlertTriangle size={20}/>
            ⚠️ 最終問題 ⚠️
            <AlertTriangle size={20}/>
          </div>
        )}

        {/* Timer Bar */}
        <div className="w-full h-2 bg-slate-800 rounded-full mb-6 overflow-hidden">
           <div 
             className={`h-full transition-all duration-100 ease-linear ${timeLeft < 5 ? 'bg-red-500' : 'bg-indigo-500'}`}
             style={{ width: `${(timeLeft / state.timeLimit) * 100}%` }}
           />
        </div>

        <div className="flex-1 grid grid-cols-2 gap-4 content-center">
           {currentQuestion?.options.map((opt, idx) => {
             const imgUrl = currentQuestion.optionImages?.[idx];
             return (
              <button
                key={idx}
                onClick={() => onAnswer(idx)}
                className={`${COLORS[idx]} w-full min-h-[140px] rounded-2xl shadow-lg flex flex-col items-center justify-center p-2 gap-2 active:scale-95 transition-transform overflow-hidden relative`}
              >
                <div className="absolute left-2 top-2 w-8 h-8 bg-black/20 rounded-full flex items-center justify-center font-bold text-white text-sm z-10">
                  {BTN_LABELS[idx]}
                </div>
                
                {imgUrl ? (
                    // Image Mode
                    <>
                        <div className="flex-1 w-full bg-white rounded-lg overflow-hidden relative">
                             <img 
                                src={imgUrl} 
                                alt="" 
                                className="absolute inset-0 w-full h-full object-contain" 
                                referrerPolicy="no-referrer"
                             />
                        </div>
                        <span className="text-white font-bold text-sm text-center line-clamp-2 w-full">{opt}</span>
                    </>
                ) : (
                    // Text Mode
                    <span className="text-white font-bold text-lg text-center leading-tight line-clamp-3 break-words w-full px-2">{opt}</span>
                )}
              </button>
             );
           })}
        </div>
      </div>
    );
  }

  // --- 4. PLAYING: RESULT ---
  if (state.gameState === GameState.PLAYING_RESULT) {
    const currentQ = state.questions[state.currentQuestionIndex];
    const myAnswer = currentPlayer?.lastAnswerIndex;
    const isCorrect = myAnswer === currentQ.correctIndex;
    const noAnswer = myAnswer === null || myAnswer === undefined;

    return (
      <div className={`h-full flex flex-col items-center justify-center p-6 text-center ${isCorrect ? 'bg-green-600' : 'bg-red-600'} text-white`}>
        <div className="mb-6">
           {isCorrect ? (
             <div className="w-32 h-32 bg-white text-green-600 rounded-full flex items-center justify-center shadow-2xl animate-in zoom-in">
                <Check size={64} strokeWidth={4} />
             </div>
           ) : (
             <div className="w-32 h-32 bg-white text-red-600 rounded-full flex items-center justify-center shadow-2xl animate-in zoom-in">
                <X size={64} strokeWidth={4} />
             </div>
           )}
        </div>
        
        <h2 className="text-4xl font-black mb-2">{isCorrect ? 'CORRECT!' : (noAnswer ? 'TIME UP' : 'WRONG')}</h2>
        <div className="text-xl font-bold opacity-90 mb-8">
          {isCorrect ? '+10 Points' : 'Don\'t give up!'}
        </div>

        <div className="w-full max-w-sm bg-black/20 p-6 rounded-xl text-left backdrop-blur-sm">
          <p className="text-xs uppercase opacity-70 mb-1 font-bold">Answer</p>
          <p className="text-xl font-bold">{currentQ.options[currentQ.correctIndex]}</p>
        </div>
        
        <div className="mt-8 flex flex-col items-center">
           <p className="text-sm opacity-70 mb-1">Current Score</p>
           <p className="text-4xl font-mono font-bold">{currentPlayer?.score}</p>
        </div>
      </div>
    );
  }

  // --- 5. FINAL RESULT (Staged Reveal) ---
  if (state.gameState === GameState.FINAL_RESULT) {
     // Calculate Rank: Score Desc -> Time Asc
     const sortedPlayers = [...state.players].sort((a, b) => {
         if (b.score !== a.score) return b.score - a.score;
         const timeA = a.totalResponseTime || 0;
         const timeB = b.totalResponseTime || 0;
         return timeA - timeB;
     });
     
     const myRankIndex = sortedPlayers.findIndex(p => p.id === playerId);
     const myRank = myRankIndex + 1;
     
     // Determine visibility based on stage
     let showMyResult = false;
     if (myRank > 3) {
         showMyResult = true; // Always show if not in top 3 (unless hiding below top 3)
     } else if (myRank === 3 && state.rankingRevealStage >= 1) {
         showMyResult = true;
     } else if (myRank === 2 && state.rankingRevealStage >= 2) {
         showMyResult = true;
     } else if (myRank === 1 && state.rankingRevealStage >= 3) {
         showMyResult = true;
     }

     // Special case: If host enabled "hide below top 3" AND I am > 3rd
     if (state.hideBelowTop3 && myRank > 3) {
         return (
             <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-8 text-white text-center relative">
                 <div className="z-10 flex flex-col items-center">
                     <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center mb-6 animate-in zoom-in">
                        <PartyPopper size={40} className="text-white" />
                     </div>
                     <h2 className="text-3xl font-black mb-4 text-white">
                         THANK YOU!
                     </h2>
                     <p className="text-lg text-indigo-200 mb-8">
                         ご参加ありがとうございました！<br/>
                         クイズ大会は終了です。
                     </p>
                     <div className="text-3xl font-mono font-bold text-indigo-400 mb-2">{currentPlayer?.score} pts</div>
                     <button onClick={onBack} className="mt-8 flex items-center gap-2 text-slate-500 hover:text-white transition">
                        <LogOut size={16} />
                        Exit
                    </button>
                 </div>
             </div>
         );
     }

     if (!showMyResult) {
         // Suspense Screen for Top Rankers (Generic message now)
         return (
             <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-8 text-white text-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
                 <div className="z-10 flex flex-col items-center">
                     <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-6 animate-pulse-fast shadow-[0_0_30px_rgba(99,102,241,0.5)]">
                        <Sparkles size={40} className="text-white" />
                     </div>
                     <h2 className="text-3xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500">
                         結果発表中...
                     </h2>
                     <p className="text-xl text-indigo-200 mb-8">
                         スクリーンでの発表をお待ちください...
                     </p>
                     <div className="px-6 py-2 bg-white/10 rounded-full backdrop-blur-md border border-white/20">
                         <Lock size={16} className="inline mr-2 mb-1" />
                         <span>Result Hidden</span>
                     </div>
                 </div>
             </div>
         );
     }

     // Revealed Result (Normal)
     return (
         <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center relative overflow-hidden">
             {myRank === 1 && <div className="absolute inset-0 bg-gradient-to-b from-yellow-600/20 to-slate-900 animate-pulse"></div>}
             
             <div className="z-10 flex flex-col items-center">
                {myRank === 1 ? (
                    <Trophy size={80} className="text-yellow-400 mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] animate-bounce-short" />
                ) : myRank === 2 ? (
                    <Medal size={80} className="text-slate-300 mb-4" />
                ) : myRank === 3 ? (
                    <Medal size={80} className="text-amber-600 mb-4" />
                ) : (
                    <div className="text-6xl font-black text-slate-600 mb-4">#{myRank}</div>
                )}

                <h2 className="text-2xl font-bold text-slate-400 uppercase tracking-widest mb-2">Final Ranking</h2>
                <div className="text-6xl font-black mb-2">{myRank}<span className="text-2xl align-top ml-1">位</span></div>
                <div className="text-3xl font-mono font-bold text-indigo-400 mb-8">{currentPlayer?.score} pts</div>
                
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-white transition">
                    <LogOut size={16} />
                    Exit
                </button>
             </div>
         </div>
     );
  }

  return null;
};

export default PlayerScreen;
