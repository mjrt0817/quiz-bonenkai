import React, { useState, useEffect, useRef } from 'react';
import { GameState, HostState, BTN_LABELS, COLORS } from '../types';
import { Users, Trophy, CheckCircle, Sparkles, Monitor, Loader2, Medal, AlertTriangle, Volume2, VolumeX, Music } from 'lucide-react';

interface HostScreenProps {
  state: HostState;
  onBack: () => void;
}

// Sound Assets
const AUDIO_SRC = {
  TICKING: "https://actions.google.com/sounds/v1/alarms/mechanical_clock_ticking.ogg",
  FANFARE: "https://actions.google.com/sounds/v1/crowds/battle_crowd_celebrate_stutter.ogg",
  DRUMROLL: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Drum_roll.ogg"
};

const HostScreen: React.FC<HostScreenProps> = ({ state, onBack }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [playerUrl, setPlayerUrl] = useState('');
  
  // Sound State
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  
  // Ranking Reveal State
  const [isDrumrolling, setIsDrumrolling] = useState(false);
  const prevRankingStage = useRef(state.rankingRevealStage);
  
  // Refs for Audio Elements
  const tickingAudioRef = useRef<HTMLAudioElement | null>(null);
  const fanfareAudioRef = useRef<HTMLAudioElement | null>(null);
  const drumrollAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPlayerUrl(`${window.location.origin}/player`);
    }
  }, []);

  // Handler to toggle sound and "unlock" audio context
  // Fixed: Don't block UI if audio fails to load immediately. Just try to unlock.
  const toggleSound = () => {
    if (!soundEnabled) {
      // Attempt to wake up all audio elements
      [tickingAudioRef, fanfareAudioRef, drumrollAudioRef].forEach(ref => {
        if (ref.current) {
          // Play and immediately pause to unlock AudioContext on mobile/strict browsers
          ref.current.volume = 0.5;
          ref.current.play().then(() => {
             ref.current?.pause();
             if(ref.current) ref.current.currentTime = 0;
          }).catch(e => {
             console.warn("Audio unlock warning (normal if not loaded yet):", e);
          });
        }
      });
      setSoundEnabled(true);
      setAudioError(null);
    } else {
      setSoundEnabled(false);
      // Pause all
      [tickingAudioRef, fanfareAudioRef, drumrollAudioRef].forEach(ref => {
        if(ref.current) {
            ref.current.pause();
            ref.current.currentTime = 0;
        }
      });
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

  // --- SOUND & ANIMATION LOGIC ---
  
  useEffect(() => {
    if (!soundEnabled) return;

    // 1. Ticking Sound (Answer Time)
    // Play only when playing question and time is remaining
    if (state.gameState === GameState.PLAYING_QUESTION && timeLeft > 0.5) {
        if (tickingAudioRef.current && tickingAudioRef.current.paused) {
            tickingAudioRef.current.volume = 0.5;
            tickingAudioRef.current.loop = true;
            tickingAudioRef.current.play().catch(e => console.warn("Ticking play failed", e));
        }
    } else {
        if (tickingAudioRef.current) {
            tickingAudioRef.current.pause();
            tickingAudioRef.current.currentTime = 0;
        }
    }

    // 2. Ranking Reveal (Drumroll -> Fanfare)
    if (state.gameState === GameState.FINAL_RESULT) {
        // Detect stage change
        if (state.rankingRevealStage > prevRankingStage.current) {
            // Only play effects for top 3 (Stages 1, 2, 3)
            if (state.rankingRevealStage >= 1) {
                setIsDrumrolling(true);
                
                // Stop Fanfare if playing
                if (fanfareAudioRef.current) {
                    fanfareAudioRef.current.pause();
                    fanfareAudioRef.current.currentTime = 0;
                }

                // Play Drumroll
                if (drumrollAudioRef.current) {
                    drumrollAudioRef.current.volume = 0.8;
                    drumrollAudioRef.current.currentTime = 0;
                    drumrollAudioRef.current.loop = true; // Loop drumroll during suspense
                    drumrollAudioRef.current.play().catch(e => console.warn("Drumroll failed", e));
                }

                // Wait 3.5 seconds, then Stop Drumroll -> Play Fanfare -> Show Result
                const suspenseTime = 3500;
                setTimeout(() => {
                    if (drumrollAudioRef.current) {
                        drumrollAudioRef.current.pause();
                        drumrollAudioRef.current.currentTime = 0;
                    }
                    if (fanfareAudioRef.current) {
                        fanfareAudioRef.current.volume = 1.0;
                        fanfareAudioRef.current.currentTime = 0;
                        fanfareAudioRef.current.play().catch(e => console.warn("Fanfare failed", e));
                    }
                    setIsDrumrolling(false); // Reveal the visual
                }, suspenseTime);
            }
        }
        prevRankingStage.current = state.rankingRevealStage;
    } else {
        prevRankingStage.current = 0;
        setIsDrumrolling(false);
    }

  }, [state.gameState, state.rankingRevealStage, timeLeft, soundEnabled]);


  // Helper for Final Question
  const isFinalQuestion = state.questions.length > 0 && state.currentQuestionIndex === state.questions.length - 1;

  // Sorted Players for Ranking
  const sortedPlayers = [...state.players].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.totalResponseTime || 0) - (b.totalResponseTime || 0);
  });

  return (
    <div className="h-full bg-slate-900 text-white flex flex-col font-sans relative overflow-hidden">
      
      {/* HIDDEN AUDIO ELEMENTS */}
      {/* Added crossOrigin anonymous to help with some CORS issues */}
      <audio ref={tickingAudioRef} src={AUDIO_SRC.TICKING} crossOrigin="anonymous" preload="auto" />
      <audio ref={fanfareAudioRef} src={AUDIO_SRC.FANFARE} crossOrigin="anonymous" preload="auto" />
      <audio ref={drumrollAudioRef} src={AUDIO_SRC.DRUMROLL} crossOrigin="anonymous" preload="auto" />

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
        
        {/* 1. LOBBY SCREEN */}
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
                  {state.players.length === 0 && (
                      <p className="col-span-full text-center text-slate-500 py-10">待機中...</p>
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

        {/* 3. RESULT SCREEN */}
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

        {/* 4. FINAL RANKING SCREEN (Staged Reveal with Drumroll) */}
        {state.gameState === GameState.FINAL_RESULT && (
           <div className="absolute inset-0 flex flex-col p-6 bg-slate-900 items-center justify-center">
              <div className="text-center mb-10">
                 <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-600 drop-shadow-sm inline-flex items-center gap-6">
                    <Trophy size={64} className="text-yellow-500" /> FINAL RANKING
                 </h2>
              </div>

              {/* PODIUM ONLY - CENTERED */}
              <div className="w-full max-w-5xl h-[600px] flex items-end justify-center gap-8 pb-10">
                  
                  {/* 2nd Place */}
                  <div className={`w-1/3 flex flex-col justify-end items-center transition-all duration-700 transform ${state.rankingRevealStage >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
                     {state.rankingRevealStage === 2 && isDrumrolling ? (
                       <div className="mb-20 animate-pulse text-6xl font-black text-slate-500">???</div>
                     ) : (
                       <>
                         <div className="mb-4 text-center">
                             <Medal size={80} className="text-slate-300 mx-auto mb-2" />
                             <div className="text-3xl font-bold text-slate-300">2nd</div>
                             <div className="text-4xl font-black truncate max-w-[280px]">{sortedPlayers[1]?.name || '-'}</div>
                             <div className="font-mono text-2xl text-indigo-400">{sortedPlayers[1]?.score || 0} pts</div>
                         </div>
                         <div className="w-full h-[300px] bg-gradient-to-t from-slate-700 to-slate-600 rounded-t-2xl shadow-2xl border-t-8 border-slate-400"></div>
                       </>
                     )}
                  </div>

                  {/* 1st Place */}
                  <div className={`w-1/3 flex flex-col justify-end items-center z-10 transition-all duration-700 delay-200 transform ${state.rankingRevealStage >= 3 ? 'translate-y-0 opacity-100 scale-110' : 'translate-y-20 opacity-0'}`}>
                     {state.rankingRevealStage === 3 && isDrumrolling ? (
                       <div className="mb-32 animate-bounce text-8xl font-black text-yellow-500">???</div>
                     ) : (
                       <>
                         <div className="mb-4 text-center">
                             <Trophy size={100} className="text-yellow-400 mx-auto mb-4 animate-bounce-short" />
                             <div className="text-4xl font-bold text-yellow-400">1st</div>
                             <div className="text-5xl font-black truncate max-w-[350px] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{sortedPlayers[0]?.name || '-'}</div>
                             <div className="font-mono text-4xl text-yellow-200">{sortedPlayers[0]?.score || 0} pts</div>
                         </div>
                         <div className="w-full h-[450px] bg-gradient-to-t from-yellow-600 to-yellow-500 rounded-t-2xl shadow-[0_0_80px_rgba(234,179,8,0.4)] border-t-8 border-yellow-300 relative overflow-hidden">
                             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>
                         </div>
                       </>
                     )}
                  </div>

                  {/* 3rd Place */}
                  <div className={`w-1/3 flex flex-col justify-end items-center transition-all duration-700 transform ${state.rankingRevealStage >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
                     {state.rankingRevealStage === 1 && isDrumrolling ? (
                       <div className="mb-10 animate-pulse text-6xl font-black text-amber-700">???</div>
                     ) : (
                       <>
                         <div className="mb-4 text-center">
                             <Medal size={80} className="text-amber-700 mx-auto mb-2" />
                             <div className="text-3xl font-bold text-amber-700">3rd</div>
                             <div className="text-4xl font-black truncate max-w-[280px]">{sortedPlayers[2]?.name || '-'}</div>
                             <div className="font-mono text-2xl text-indigo-400">{sortedPlayers[2]?.score || 0} pts</div>
                         </div>
                         <div className="w-full h-[200px] bg-gradient-to-t from-amber-800 to-amber-700 rounded-t-2xl shadow-2xl border-t-8 border-amber-600"></div>
                       </>
                     )}
                  </div>
              </div>
           </div>
        )}

      </main>

      {/* FOOTER CONTROLS */}
      <footer className="bg-slate-800 p-2 flex justify-between items-center text-xs text-slate-500 z-10">
        <button 
           onClick={toggleSound}
           className={`flex items-center gap-2 px-3 py-1 rounded transition border ${soundEnabled ? 'bg-green-600 text-white border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600'}`}
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
