import React, { useState, useEffect } from 'react';
import { GameState, HostState, BTN_LABELS, COLORS } from '../types';
import { Users, Trophy, CheckCircle, Sparkles, QrCode, Clock, Monitor, Loader2, Medal } from 'lucide-react';

interface HostScreenProps {
  state: HostState;
  onBack: () => void;
}

const HostScreen: React.FC<HostScreenProps> = ({ state, onBack }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [playerUrl, setPlayerUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('role');
      url.searchParams.set('role', 'player');
      setPlayerUrl(url.toString());
    }
  }, []);

  // Visual Timer Logic
  useEffect(() => {
    let timerId: any;
    if (state.gameState === GameState.PLAYING_QUESTION && state.questionStartTime) {
      timerId = setInterval(() => {
        const elapsedSeconds = (Date.now() - (state.questionStartTime || 0)) / 1000;
        const remaining = Math.max(0, state.timeLimit - elapsedSeconds);
        setTimeLeft(remaining);
        if (remaining <= 0) clearInterval(timerId);
      }, 100);
    } else {
      setTimeLeft(0);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [state.gameState, state.questionStartTime, state.timeLimit]);

  const answerCount = state.players.filter(p => p.lastAnswerIndex !== null && p.lastAnswerIndex !== undefined).length;
  const totalPlayers = state.players.length;
  // Safety check for current question
  const currentQ = state.questions && state.questions[state.currentQuestionIndex] 
    ? state.questions[state.currentQuestionIndex] 
    : { text: "Loading...", options: [], correctIndex: 0, explanation: "" };

  const isFinalQuestion = state.questions.length > 0 && state.currentQuestionIndex === state.questions.length - 1;

  // --- 1. SETUP MODE (Waiting for Admin) ---
  if (state.gameState === GameState.SETUP) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-6 relative overflow-hidden">
        {/* Background Animation */}
        <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
           <div className="absolute top-10 left-10 w-64 h-64 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
           <div className="absolute bottom-10 right-10 w-64 h-64 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl animate-pulse animation-delay-2000"></div>
        </div>

        <div className="z-10 text-center space-y-8">
           <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400 tracking-tight">
             QUIZ EVENT
           </h1>
           <div className="flex flex-col items-center gap-4 text-slate-400">
             <Loader2 size={48} className="animate-spin text-indigo-500"/>
             <p className="text-xl font-light tracking-widest uppercase">Waiting for Admin to start...</p>
           </div>
        </div>

        <div className="absolute bottom-8 right-8 text-slate-600 text-sm flex items-center gap-2">
           <Monitor size={16} /> Projector View
        </div>
      </div>
    );
  }

  // --- 2. LOBBY MODE ---
  if (state.gameState === GameState.LOBBY) {
    return (
      <div className="flex flex-col h-screen bg-slate-900 text-white">
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center relative">
          <div className="flex flex-col lg:flex-row items-center gap-16 mb-12 z-10">
            <div className="text-left space-y-6">
               <div>
                 <span className="inline-block px-3 py-1 bg-indigo-600 text-xs font-bold rounded-full mb-2">ENTRY</span>
                 <h1 className="text-6xl font-black mb-2 tracking-wide text-white">参加受付中</h1>
                 <p className="text-2xl text-indigo-300">QRコードを読み込んで参加してください</p>
               </div>
               
               <div className="space-y-4 text-lg">
                  <div className="flex items-center gap-4 text-slate-300 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <span className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center font-bold">1</span>
                    <span>スマホでQRコードをスキャン</span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-300 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <span className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center font-bold">2</span>
                    <span>ニックネームを入力して待機</span>
                  </div>
                  <div className="mt-4 p-2 bg-black/30 rounded text-xs font-mono text-slate-500">
                    {playerUrl}
                  </div>
               </div>
            </div>

            {/* QR Code */}
            <div className="p-8 bg-white rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.1)] transform rotate-2">
               <div className="w-64 h-64 bg-slate-100 flex flex-col items-center justify-center overflow-hidden rounded-xl">
                 {playerUrl ? (
                   <img 
                     src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(playerUrl)}`}
                     alt="Join QR Code"
                     className="w-full h-full object-cover"
                   />
                 ) : (
                   <QrCode size={80} className="text-slate-900" />
                 )}
               </div>
               <div className="mt-4 text-center">
                 <p className="font-bold text-slate-900 text-xl tracking-widest">JOIN NOW</p>
               </div>
            </div>
          </div>

          {/* Player List */}
          <div className="w-full max-w-6xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <h3 className="text-2xl font-bold text-slate-400">
                 Entry List
              </h3>
              <span className="text-4xl font-black text-white">{state.players.length} <span className="text-lg font-normal text-slate-500">Players</span></span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {state.players.map(player => (
                <div key={player.id} className="p-4 bg-slate-800 rounded-xl border border-slate-700 flex items-center gap-3 animate-in zoom-in duration-300">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-xs">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold truncate">{player.name}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --- 3. GAME SCREEN ---
  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      
      {/* Top Bar */}
      <header className="bg-slate-900 p-6 flex justify-between items-center border-b border-slate-800 shadow-lg relative z-20">
        <div className="flex items-center gap-6">
          <div className={`px-4 py-2 rounded-lg border flex items-center gap-3 ${isFinalQuestion && state.gameState !== GameState.FINAL_RESULT ? 'bg-red-600 border-red-500' : 'bg-slate-800 border-slate-700'}`}>
             <span className="text-white/80 text-sm font-bold block uppercase text-xs">
                {isFinalQuestion && state.gameState !== GameState.FINAL_RESULT ? 'FINAL QUESTION' : 'Question'}
             </span>
             <span className="text-2xl font-black font-mono text-white">{state.currentQuestionIndex + 1}<span className="text-white/50 text-lg">/{state.questions.length}</span></span>
          </div>
        </div>
        
        {state.gameState === GameState.PLAYING_QUESTION && (
          <div className={`flex items-center gap-3 text-4xl font-mono font-black ${timeLeft < 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
             <Clock size={36} />
             {Math.ceil(timeLeft)}
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="px-6 py-2 bg-indigo-900/30 border border-indigo-500/30 rounded-full flex items-center gap-3">
             <Users size={20} className="text-indigo-400"/>
             <span className="text-xl font-bold">{answerCount}</span>
             <span className="text-slate-500">/ {totalPlayers} Answered</span>
          </div>
        </div>
      </header>
      
      {/* Timer Bar */}
      {state.gameState === GameState.PLAYING_QUESTION && (
        <div className="h-3 bg-slate-900 w-full">
           <div 
             className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all ease-linear duration-100"
             style={{ width: `${(timeLeft / state.timeLimit) * 100}%` }}
           />
        </div>
      )}

      <main className="flex-1 flex flex-col p-8 max-w-7xl mx-auto w-full relative z-10">
        
        {state.gameState === GameState.FINAL_RESULT ? (
           <div className="flex-1 flex flex-col items-center justify-center relative">
             <h1 className="text-6xl font-black mb-12 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-700 drop-shadow-lg text-center">
               TOURNAMENT RESULTS
             </h1>
             
             <div className="w-full grid grid-cols-1 gap-4 justify-items-center">
               {/* Logic for Ranking Reveal Stages */}
               {(() => {
                   const sorted = [...state.players].sort((a, b) => b.score - a.score);
                   const first = sorted[0];
                   const second = sorted[1];
                   const third = sorted[2];
                   const others = sorted.slice(3);
                   const stage = state.rankingRevealStage; // 0, 1, 2, 3

                   return (
                       <div className="w-full max-w-5xl flex flex-col items-center gap-8">
                           
                           {/* Stage 3: Winner (Gold) */}
                           {stage >= 3 && first && (
                               <div className="w-full max-w-2xl bg-gradient-to-b from-yellow-500/20 to-slate-900 border-4 border-yellow-500 p-8 rounded-3xl flex flex-col items-center justify-center shadow-[0_0_50px_rgba(234,179,8,0.5)] animate-in zoom-in duration-1000 relative overflow-hidden">
                                   <div className="absolute inset-0 bg-yellow-500/10 animate-pulse"></div>
                                   <Trophy size={80} className="text-yellow-400 mb-4 drop-shadow-lg" />
                                   <h2 className="text-yellow-300 font-black text-2xl tracking-[0.2em] mb-2">WINNER</h2>
                                   <div className="text-6xl md:text-7xl font-black text-white mb-4 text-center leading-tight">{first.name}</div>
                                   <div className="text-5xl font-mono font-bold text-yellow-400">{first.score} <span className="text-2xl">pts</span></div>
                               </div>
                           )}

                           <div className="flex flex-row gap-4 w-full justify-center items-end">
                               {/* Stage 2: 2nd Place (Silver) */}
                               {stage >= 2 && second && (
                                   <div className="flex-1 max-w-sm bg-slate-800/80 border-2 border-slate-400 p-6 rounded-2xl flex flex-col items-center shadow-2xl animate-in slide-in-from-bottom-20 duration-700">
                                       <Medal size={48} className="text-slate-300 mb-2" />
                                       <h2 className="text-slate-400 font-bold text-lg tracking-widest mb-1">2ND PLACE</h2>
                                       <div className="text-3xl font-bold text-white mb-2 truncate max-w-full">{second.name}</div>
                                       <div className="text-3xl font-mono font-bold text-slate-300">{second.score}</div>
                                   </div>
                               )}

                               {/* Stage 1: 3rd Place (Bronze) */}
                               {stage >= 1 && third && (
                                   <div className="flex-1 max-w-sm bg-slate-800/80 border-2 border-amber-700 p-6 rounded-2xl flex flex-col items-center shadow-2xl animate-in slide-in-from-bottom-20 duration-700 order-first md:order-last">
                                       <Medal size={48} className="text-amber-600 mb-2" />
                                       <h2 className="text-amber-700 font-bold text-lg tracking-widest mb-1">3RD PLACE</h2>
                                       <div className="text-3xl font-bold text-white mb-2 truncate max-w-full">{third.name}</div>
                                       <div className="text-3xl font-mono font-bold text-amber-600">{third.score}</div>
                                   </div>
                               )}
                           </div>

                           {/* Stage 0: Others (Grid) */}
                           {stage >= 0 && others.length > 0 && (
                               <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 opacity-80">
                                   {others.slice(0, 8).map((p, i) => (
                                       <div key={p.id} className="bg-slate-800/50 border border-slate-700 p-3 rounded flex items-center justify-between text-sm">
                                           <div className="flex items-center gap-2">
                                               <span className="text-slate-500 font-mono">#{i+4}</span>
                                               <span className="font-bold truncate">{p.name}</span>
                                           </div>
                                           <span className="font-mono text-slate-400">{p.score}</span>
                                       </div>
                                   ))}
                               </div>
                           )}
                       </div>
                   );
               })()}
             </div>
           </div>
        ) : (
          <>
            <div className="flex-1 flex flex-col justify-center mb-8">
              <h2 className="text-4xl md:text-6xl font-bold leading-tight drop-shadow-xl text-center">
                {currentQ.text}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 h-[40vh]">
              {currentQ.options && currentQ.options.map((opt, idx) => {
                const isReveal = state.gameState === GameState.PLAYING_RESULT;
                const isCorrect = idx === currentQ.correctIndex;
                
                let cardClass = `relative p-8 rounded-2xl border-4 transition-all duration-500 flex items-center overflow-hidden group `;
                
                if (isReveal) {
                  if (isCorrect) {
                    cardClass += `bg-green-600 border-green-400 shadow-[0_0_40px_rgba(74,222,128,0.4)] scale-105 opacity-100 z-10`;
                  } else {
                    cardClass += `bg-slate-800 border-slate-700 opacity-30 grayscale blur-sm scale-95`;
                  }
                } else {
                   cardClass += `bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-500`;
                }

                return (
                  <div key={idx} className={cardClass}>
                    <div className={`absolute left-0 top-0 bottom-0 w-4 ${COLORS[idx].split(' ')[0]}`} />
                    
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl mr-6 z-10 shadow-lg ${isReveal && isCorrect ? 'bg-white text-green-600' : 'bg-slate-700 text-slate-300'}`}>
                      {BTN_LABELS[idx]}
                    </div>
                    
                    <span className="text-3xl md:text-4xl font-bold z-10 leading-snug">{opt}</span>
                    
                    {isReveal && isCorrect && (
                      <CheckCircle className="absolute right-6 text-white w-16 h-16 animate-in zoom-in spin-in-90 duration-500" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Explanation Area */}
            {state.gameState === GameState.PLAYING_RESULT && (
              <div className="w-full p-8 bg-indigo-900/80 backdrop-blur-md border border-indigo-500/50 rounded-3xl text-indigo-100 animate-in slide-in-from-bottom-10 shadow-2xl">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-500 rounded-full">
                    <Sparkles size={32} className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xl text-indigo-300 mb-2 uppercase tracking-wider">Explanation</h4>
                    <p className="text-2xl md:text-3xl font-medium leading-relaxed">{currentQ.explanation}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default HostScreen;
