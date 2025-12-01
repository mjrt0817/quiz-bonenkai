import React, { useState, useEffect, useRef } from 'react';
import { GameState, HostState, BTN_LABELS, COLORS } from '../types';
import { Users, Trophy, CheckCircle, Sparkles, Clock, Monitor, Loader2, Medal, AlertTriangle, Volume2, VolumeX } from 'lucide-react';

interface HostScreenProps {
  state: HostState;
  onBack: () => void;
}

// Sound Assets (Google Actions Sound Library - Free to use)
const AUDIO_SRC = {
  TICKING: "https://actions.google.com/sounds/v1/alarms/mechanical_clock_ticking.ogg",
  FANFARE: "https://actions.google.com/sounds/v1/crowds/battle_crowd_celebrate_stutter.ogg"
};

const HostScreen: React.FC<HostScreenProps> = ({ state, onBack }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [playerUrl, setPlayerUrl] = useState('');
  
  // Sound State
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  
  // Refs for Audio Elements
  const tickingAudioRef = useRef<HTMLAudioElement | null>(null);
  const fanfareAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevRankingStage = useRef(state.rankingRevealStage);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPlayerUrl(`${window.location.origin}/player`);
    }
  }, []);

  // Handler to toggle sound and "unlock" audio context
  const toggleSound = async () => {
    if (!soundEnabled) {
      // Trying to enable sound
      // We must interact with the elements to unlock autoplay
      try {
        if (tickingAudioRef.current) {
            tickingAudioRef.current.volume = 0.5;
            // Play briefly then pause to unlock
            await tickingAudioRef.current.play();
            tickingAudioRef.current.pause();
        }
        if (fanfareAudioRef.current) {
            fanfareAudioRef.current.volume = 0.8;
            await fanfareAudioRef.current.play();
            fanfareAudioRef.current.pause();
            fanfareAudioRef.current.currentTime = 0;
        }
        setSoundEnabled(true);
        setAudioError(null);
      } catch (e) {
        console.error("Audio unlock failed", e);
        setAudioError("再生できませんでした。ブラウザ設定を確認してください。");
      }
    } else {
      // Disable sound
      if (tickingAudioRef.current) tickingAudioRef.current.pause();
      if (fanfareAudioRef.current) fanfareAudioRef.current.pause();
      setSoundEnabled(false);
    }
  };

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

  // --- SOUND LOGIC ---
  
  useEffect(() => {
    if (!soundEnabled) return;

    // 1. Ticking
    // Play only during question time and when time is remaining
    if (state.gameState === GameState.PLAYING_QUESTION && timeLeft > 0) {
        // Prevent constant play() calls if already playing
        if (tickingAudioRef.current && tickingAudioRef.current.paused) {
            tickingAudioRef.current.play().catch(() => {});
        }
    } else {
        if (tickingAudioRef.current) {
            tickingAudioRef.current.pause();
            tickingAudioRef.current.currentTime = 0;
        }
    }

    // 2. Fanfare
    // Play when ranking stage increments
    if (state.gameState === GameState.FINAL_RESULT) {
        if (state.rankingRevealStage > prevRankingStage.current) {
            if (fanfareAudioRef.current) {
                fanfareAudioRef.current.currentTime = 0;
                fanfareAudioRef.current.play().catch(() => {});
            }
        }
        prevRankingStage.current = state.rankingRevealStage;
    } else {
        prevRankingStage.current = 0; // Reset tracking
    }

  }, [state.gameState, state.rankingRevealStage, timeLeft, soundEnabled]);


  // Helper for Final Question
  const isFinalQuestion = state.questions.length > 0 && state.currentQuestionIndex === state.questions.length - 1;


  return (
    <div className="h-full bg-slate-900 text-white flex flex-col font-sans relative overflow-hidden">
      
      {/* HIDDEN AUDIO ELEMENTS */}
      <audio ref={tickingAudioRef} src={AUDIO_SRC.TICKING} loop preload="auto" />
      <audio ref={fanfareAudioRef} src={AUDIO_SRC.FANFARE} preload="auto" />

      {/* HEADER */}
      <header className="bg-slate-800 p-4 flex justify-between items-center shadow-md z-10">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Monitor size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-none">{state.quizTitle}</h1>
            <p className="text-xs text-slate-400">参加者: {state.players.length}名</p>
          </div>
        </div>
        
        {/* FINAL QUESTION BANNER */}
        {state.gameState === GameState.PLAYING_QUESTION && isFinalQuestion && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-2 rounded-full font-black text-xl animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.6)] flex items-center gap-2 border-2 border-white">
                <AlertTriangle /> 最終問題 <AlertTriangle />
            </div>
        )}

        {/* QR Code (Mini) */}
        {state.gameState !== GameState.SETUP && state.gameState !== GameState.LOBBY && (
             <div className="bg-white p-1 rounded">
               <img 
                 src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(playerUrl)}`}
                 alt="Join QR"
                 className="w-10 h-10"
               />
             </div>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 relative flex flex-col">
        
        {/* 1. LOBBY SCREEN (100 Players Optimized) */}
        {(state.gameState === GameState.SETUP || state.gameState === GameState.LOBBY) && (
          <div className="absolute inset-0 flex flex-col items-center justify-start pt-10 p-6">
            <h2 className="text-4xl md:text-5xl font-black mb-4 text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
              参加者募集中
            </h2>
            
            <div className="flex flex-col md:flex-row items-center gap-8 mb-8 bg-slate-800/50 p-6 rounded-3xl border border-slate-700">
              <div className="bg-white p-2 rounded-xl shadow-2xl">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(playerUrl)}`}
                  alt="Join QR"
                  className="w-48 h-48 md:w-64 md:h-64"
                />
              </div>
              <div className="text-center md:text-left">
                <p className="text-slate-400 mb-2">スマホでQRコードを読み込んで参加！</p>
                <p className="text-3xl font-mono font-bold text-white bg-slate-900 px-6 py-3 rounded-xl border border-slate-600">
                  {playerUrl}
                </p>
              </div>
            </div>

            {/* Scrollable Player Grid for 100+ players */}
            <div className="w-full max-w-6xl flex-1 bg-slate-800/30 rounded-2xl border border-slate-700 p-4 overflow-hidden flex flex-col">
               <h3 className="text-lg font-bold text-slate-400 mb-4 flex items-center gap-2">
                 <Users size={20}/> エントリー済み ({state.players.length}名)
               </h3>
               <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 content-start">
                  {state.players.map(player => (
                    <div key={player.id} className="bg-slate-700 p-2 rounded-lg flex items-center gap-2 animate-in zoom-in duration-300">
                      <div className={`w-2 h-2 rounded-full ${player.isOnline !== false ? 'bg-green-400' : 'bg-gray-500'}`} />
                      <span className="font-bold text-sm truncate">{player.name}</span>
                    </div>
                  ))}
                  {/* Empty placeholders if few players */}
                  {state.players.length === 0 && (
                      <p className="col-span-full text-center text-slate-500 py-10">
                        待機中...
                      </p>
                  )}
               </div>
            </div>
          </div>
        )}

        {/* 2. QUESTION SCREEN */}
        {state.gameState === GameState.PLAYING_QUESTION && state.questions[state.currentQuestionIndex] && (
          <div className="absolute inset-0 flex flex-col p-8">
            {/* Timer Bar */}
            <div className="w-full h-4 bg-slate-800 rounded-full mb-8 overflow-hidden border border-slate-700">
              <div 
                className={`h-full transition-all duration-100 ease-linear ${timeLeft < 5 ? 'bg-red-500' : 'bg-indigo-500'}`}
                style={{ width: `${(timeLeft / state.timeLimit) * 100}%` }}
              />
            </div>

            <div className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full">
               <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700 mb-8 text-center min-h-[200px] flex items-center justify-center">
                 <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                   {state.questions[state.currentQuestionIndex].text}
                 </h2>
               </div>

               <div className="grid grid-cols-2 gap-6 h-[400px]">
                 {state.questions[state.currentQuestionIndex].options.map((option, idx) => (
                   <div key={idx} className={`${COLORS[idx]} rounded-2xl flex items-center p-6 shadow-lg relative overflow-hidden group`}>
                      <div className="absolute left-0 top-0 bottom-0 w-24 bg-black/20 flex items-center justify-center text-4xl font-black text-white/50">
                        {BTN_LABELS[idx]}
                      </div>
                      <span className="ml-24 text-3xl font-bold text-white shadow-black drop-shadow-md">
                        {option}
                      </span>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {/* 3. QUESTION RESULT SCREEN */}
        {state.gameState === GameState.PLAYING_RESULT && state.questions[state.currentQuestionIndex] && (
           <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-slate-900">
              <h2 className="text-3xl font-bold text-slate-400 mb-8 uppercase tracking-widest">Correct Answer</h2>
              
              <div className="bg-green-600 text-white p-12 rounded-3xl shadow-[0_0_50px_rgba(22,163,74,0.5)] flex flex-col items-center max-w-4xl w-full animate-in zoom-in duration-500 border-4 border-green-400">
                 <CheckCircle size={80} className="mb-6" />
                 <div className="text-5xl font-black text-center mb-4">
                    {state.questions[state.currentQuestionIndex].options[state.questions[state.currentQuestionIndex].correctIndex]}
                 </div>
                 {state.questions[state.currentQuestionIndex].explanation && (
                     <div className="mt-8 bg-black/20 p-6 rounded-xl w-full text-left">
                         <div className="flex items-center gap-2 mb-2 text-green-200 font-bold uppercase text-sm">
                             <Sparkles size={16}/> 解説
                         </div>
                         <p className="text-xl leading-relaxed">
                            {state.questions[state.currentQuestionIndex].explanation}
                         </p>
                     </div>
                 )}
              </div>
           </div>
        )}

        {/* 4. FINAL RANKING SCREEN (Staged Reveal) */}
        {state.gameState === GameState.FINAL_RESULT && (
           <div className="absolute inset-0 flex flex-col p-6 bg-slate-900">
              <div className="text-center mb-6">
                 <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-600 drop-shadow-sm inline-flex items-center gap-4">
                    <Trophy size={48} className="text-yellow-500" /> FINAL RANKING
                 </h2>
              </div>

              {/* Ranking Grid */}
              <div className="flex-1 flex gap-6 max-w-7xl mx-auto w-full">
                  
                  {/* LEFT: 4th Place and below (Scrollable) */}
                  {!state.hideBelowTop3 && (
                  <div className={`flex-1 bg-slate-800/50 rounded-2xl border border-slate-700 p-4 flex flex-col transition-opacity duration-500 ${state.rankingRevealStage >= 0 ? 'opacity-100' : 'opacity-0'}`}>
                      <h3 className="text-xl font-bold text-slate-400 mb-4 border-b border-slate-700 pb-2">Result List</h3>
                      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                          {[...state.players]
                             .sort((a, b) => {
                                 if (b.score !== a.score) return b.score - a.score;
                                 return (a.totalResponseTime || 0) - (b.totalResponseTime || 0);
                             })
                             .slice(3) // Skip top 3
                             .map((p, i) => (
                             <div key={p.id} className="flex justify-between items-center bg-slate-700/50 p-3 rounded text-lg">
                                 <div className="flex items-center gap-3">
                                     <span className="font-mono text-slate-500 w-8 text-right">{i + 4}.</span>
                                     <span className="font-bold">{p.name}</span>
                                 </div>
                                 <div className="font-mono text-indigo-400">{p.score}pts</div>
                             </div>
                          ))}
                          {state.players.length <= 3 && <p className="text-slate-500 text-center mt-10">No other players</p>}
                      </div>
                  </div>
                  )}

                  {/* RIGHT: TOP 3 PODIUM */}
                  <div className="flex-[2] flex flex-col justify-end pb-10 relative">
                      <div className="flex justify-center items-end gap-4 h-[500px]">
                          
                          {/* 2nd Place */}
                          <div className={`w-1/3 flex flex-col justify-end items-center transition-all duration-700 transform ${state.rankingRevealStage >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
                             <div className="mb-4 text-center">
                                 <Medal size={64} className="text-slate-300 mx-auto mb-2" />
                                 <div className="text-2xl font-bold text-slate-300">2nd</div>
                                 <div className="text-3xl font-black truncate max-w-[200px]">
                                     {[...state.players].sort((a, b) => b.score - a.score || (a.totalResponseTime||0)-(b.totalResponseTime||0))[1]?.name || '-'}
                                 </div>
                                 <div className="font-mono text-xl text-indigo-400">
                                     {[...state.players].sort((a, b) => b.score - a.score || (a.totalResponseTime||0)-(b.totalResponseTime||0))[1]?.score || 0} pts
                                 </div>
                             </div>
                             <div className="w-full h-[60%] bg-gradient-to-t from-slate-700 to-slate-600 rounded-t-lg shadow-2xl border-t-4 border-slate-400"></div>
                          </div>

                          {/* 1st Place */}
                          <div className={`w-1/3 flex flex-col justify-end items-center z-10 transition-all duration-700 delay-200 transform ${state.rankingRevealStage >= 3 ? 'translate-y-0 opacity-100 scale-110' : 'translate-y-20 opacity-0'}`}>
                             <div className="mb-4 text-center">
                                 <Trophy size={80} className="text-yellow-400 mx-auto mb-2 animate-bounce-short" />
                                 <div className="text-3xl font-bold text-yellow-400">1st</div>
                                 <div className="text-4xl font-black truncate max-w-[250px] text-white drop-shadow-md">
                                     {[...state.players].sort((a, b) => b.score - a.score || (a.totalResponseTime||0)-(b.totalResponseTime||0))[0]?.name || '-'}
                                 </div>
                                 <div className="font-mono text-2xl text-yellow-200">
                                     {[...state.players].sort((a, b) => b.score - a.score || (a.totalResponseTime||0)-(b.totalResponseTime||0))[0]?.score || 0} pts
                                 </div>
                             </div>
                             <div className="w-full h-[80%] bg-gradient-to-t from-yellow-600 to-yellow-500 rounded-t-lg shadow-[0_0_50px_rgba(234,179,8,0.3)] border-t-4 border-yellow-300 relative overflow-hidden">
                                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>
                             </div>
                          </div>

                          {/* 3rd Place */}
                          <div className={`w-1/3 flex flex-col justify-end items-center transition-all duration-700 transform ${state.rankingRevealStage >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
                             <div className="mb-4 text-center">
                                 <Medal size={64} className="text-amber-700 mx-auto mb-2" />
                                 <div className="text-2xl font-bold text-amber-700">3rd</div>
                                 <div className="text-3xl font-black truncate max-w-[200px]">
                                     {[...state.players].sort((a, b) => b.score - a.score || (a.totalResponseTime||0)-(b.totalResponseTime||0))[2]?.name || '-'}
                                 </div>
                                 <div className="font-mono text-xl text-indigo-400">
                                     {[...state.players].sort((a, b) => b.score - a.score || (a.totalResponseTime||0)-(b.totalResponseTime||0))[2]?.score || 0} pts
                                 </div>
                             </div>
                             <div className="w-full h-[40%] bg-gradient-to-t from-amber-800 to-amber-700 rounded-t-lg shadow-2xl border-t-4 border-amber-600"></div>
                          </div>

                      </div>
                  </div>
              </div>
           </div>
        )}

      </main>

      {/* FOOTER CONTROLS */}
      <footer className="bg-slate-800 p-2 flex justify-between items-center text-xs text-slate-500 z-10">
        <button 
           onClick={toggleSound}
           className={`flex items-center gap-2 px-3 py-1 rounded transition ${soundEnabled ? 'bg-green-600 text-white shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          {soundEnabled ? 'SOUND ON' : 'SOUND OFF (Click to Enable)'}
        </button>
        {audioError && <span className="text-red-400 font-bold animate-pulse">{audioError}</span>}
        <div className="flex gap-4">
           <span>Room: {state.roomCode}</span>
           <button onClick={onBack} className="hover:text-white">Exit Viewer</button>
        </div>
      </footer>
    </div>
  );
};

export default HostScreen;
