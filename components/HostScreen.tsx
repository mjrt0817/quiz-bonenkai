import React, { useState, useEffect } from 'react';
import { GameState, HostState, BTN_LABELS, COLORS } from '../types';
// Added Smartphone to the imports from lucide-react to fix the "Cannot find name 'Smartphone'" error
import { Users, CheckCircle, Sparkles, Monitor, Medal, Trophy, AlertTriangle, Image as ImageIcon, Crown, Clock, Zap, Info, ShieldAlert, Smartphone } from 'lucide-react';

interface HostScreenProps {
  state: HostState;
  onBack: () => void;
}

const HostScreen: React.FC<HostScreenProps> = ({ state, onBack }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [playerUrl, setPlayerUrl] = useState('');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPlayerUrl(`${window.location.origin}/player`);
    }
  }, []);

  useEffect(() => {
    let timerId: any;
    if (state.gameState === GameState.PLAYING_QUESTION && state.isTimerRunning && state.questionStartTime) {
      timerId = setInterval(() => {
        const elapsedSeconds = (Date.now() - (state.questionStartTime || 0)) / 1000;
        const remaining = Math.max(0, state.timeLimit - elapsedSeconds);
        setTimeLeft(remaining);
        if (remaining <= 0) clearInterval(timerId);
      }, 100);
    } else {
      if (state.gameState === GameState.PLAYING_QUESTION) {
         setTimeLeft(state.timeLimit);
      } else {
         setTimeLeft(0);
      }
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [state.gameState, state.questionStartTime, state.timeLimit, state.isTimerRunning]);

  const isFinalQuestion = state.questions.length > 0 && state.currentQuestionIndex === state.questions.length - 1;

  const sortedPlayers = [...state.players].sort((a, b) => {
      if (a.isOrganizer && !b.isOrganizer) return 1;
      if (!a.isOrganizer && b.isOrganizer) return -1;
      if (b.score !== a.score) return b.score - a.score;
      return (a.totalResponseTime || 0) - (b.totalResponseTime || 0);
  });

  const isTitleOnlyMode = (state.gameState === GameState.LOBBY || state.gameState === GameState.SETUP) && !state.isLobbyDetailsVisible;
  const currentQuestion = state.questions[state.currentQuestionIndex];
  
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    const currentSrc = img.src;
    if (currentSrc.includes('lh3.googleusercontent.com/d/')) {
        if (img.dataset.retried === 'true') {
             img.style.display = 'none';
             showFallback(img);
             return;
        }
        img.dataset.retried = 'true';
        const id = currentSrc.split('/').pop();
        if (id) img.src = `https://drive.google.com/uc?export=view&id=${id}`;
        return;
    }
    img.style.display = 'none';
    showFallback(img);
  };

  const showFallback = (img: HTMLImageElement) => {
     const parent = img.parentElement;
     if (parent && !parent.querySelector('.fallback-icon')) {
        const fallback = document.createElement('div');
        fallback.className = "fallback-icon flex flex-col items-center justify-center h-full w-full bg-slate-800 text-slate-500 p-2 text-center rounded-lg";
        fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span class="text-[10px] mt-1 font-mono">Image Error</span>';
        parent.appendChild(fallback);
     }
  };

  // 全画面ルール案内コンポーネント
  const RulesOverlay = () => {
    if (!state.isRulesVisible) return null;
    
    return (
      <div className="fixed inset-0 z-[100] bg-white/65 backdrop-blur-2xl animate-in fade-in duration-500 flex flex-col items-center justify-center p-10 overflow-hidden text-slate-900">
          <div className="max-w-6xl w-full flex flex-col items-center">
            <header className="mb-20 text-center animate-in slide-in-from-top-10 duration-700">
                <div className="flex items-center justify-center gap-6 mb-4">
                    <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-2xl">
                        <ShieldAlert size={64} />
                    </div>
                    <h2 className="text-8xl font-black tracking-tighter drop-shadow-sm">QUIZ RULES</h2>
                </div>
                <p className="text-3xl font-bold text-slate-600 uppercase tracking-[0.4em] drop-shadow-sm">クイズの回答ルール</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 w-full">
                {/* Rule 1 */}
                <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-in zoom-in duration-500 delay-100">
                    <div className="w-40 h-40 rounded-full bg-green-500/10 border-4 border-green-500 flex items-center justify-center text-green-600 mb-8 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                        <Sparkles size={80} />
                    </div>
                    <h3 className="text-4xl font-black mb-6">スコア</h3>
                    <p className="text-2xl font-bold text-slate-600 leading-relaxed">
                        正解すると<br/>
                        <span className="text-6xl text-slate-900 font-black">10pts</span><br/>
                        獲得！
                    </p>
                </div>

                {/* Rule 2 */}
                <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-in zoom-in duration-500 delay-300">
                    <div className="w-40 h-40 rounded-full bg-orange-500/10 border-4 border-orange-500 flex items-center justify-center text-orange-600 mb-8 shadow-[0_0_30px_rgba(249,115,22,0.3)]">
                        <Zap size={80} />
                    </div>
                    <h3 className="text-4xl font-black mb-6">同点時の判定</h3>
                    <p className="text-2xl font-bold text-slate-600 leading-relaxed">
                        同じ点数の場合は<br/>
                        <span className="text-5xl text-slate-900 font-black">回答スピード</span><br/>
                        で順位が決まる！
                    </p>
                </div>

                {/* Rule 3 */}
                <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-in zoom-in duration-500 delay-500">
                    <div className="w-40 h-40 rounded-full bg-indigo-500/10 border-4 border-indigo-500 flex items-center justify-center text-indigo-600 mb-8 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                        <Smartphone size={80} />
                    </div>
                    <h3 className="text-4xl font-black mb-6">回答ボタン</h3>
                    <p className="text-2xl font-bold text-slate-600 leading-relaxed">
                        問題が出た後<br/>
                        <span className="text-5xl text-slate-900 font-black">司会の合図</span><br/>
                        までボタンは出ません
                    </p>
                </div>
            </div>

            <footer className="mt-20 flex flex-col items-center animate-in slide-in-from-bottom-10 duration-700">
                <div className="bg-white/80 backdrop-blur-md px-10 py-4 rounded-full flex items-center gap-4 border-2 border-indigo-100 shadow-lg">
                    <Info className="text-indigo-600" size={32} />
                    <p className="text-2xl font-black text-slate-700">準備ができたらニックネームを入力して待機！</p>
                </div>
            </footer>
          </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-slate-900 text-white flex flex-col font-sans relative overflow-hidden">
      
      {/* ルール案内オーバーレイ（フルスクリーン） */}
      <RulesOverlay />

      {!isTitleOnlyMode && (
        <header className="bg-slate-800 p-4 flex justify-between items-center shadow-md z-10 shrink-0 h-16">
            <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2 rounded-lg">
                <Monitor size={24} />
            </div>
            <div>
                <h1 className="text-xl font-bold text-white leading-none">{state.quizTitle}</h1>
                <p className="text-xs text-slate-400">参加者: {state.players.length}名</p>
            </div>
            </div>
            
            {state.gameState === GameState.PLAYING_QUESTION && isFinalQuestion && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-2 rounded-full font-black text-xl animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.6)] flex items-center gap-2 border-2 border-white z-20">
                    <AlertTriangle /> ⚠️ 最終問題 ⚠️ <AlertTriangle />
                </div>
            )}

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
      )}

      <main className="flex-1 relative flex flex-col overflow-hidden min-h-0">
        
        {(state.gameState === GameState.SETUP || state.gameState === GameState.LOBBY) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isTitleOnlyMode ? (
                <div className="w-full h-full flex items-center justify-center bg-black relative">
                     <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
                     
                     {state.titleImage ? (
                         <img 
                            src={state.titleImage} 
                            alt="Tournament Title" 
                            className="w-full h-full object-contain" 
                         />
                     ) : (
                         <div className="text-center z-10 p-10">
                            <h2 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 tracking-tight leading-tight mb-6 animate-pulse-fast">
                                {state.quizTitle}
                            </h2>
                            <p className="text-2xl text-slate-400 font-bold uppercase tracking-[0.5em]">Coming Soon</p>
                         </div>
                     )}
                </div>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-start pt-6 p-6">
                    {state.titleImage ? (
                        <div className="mb-4 max-h-[100px] flex justify-center">
                            <img src={state.titleImage} alt="Tournament Title" className="h-full object-contain drop-shadow-lg" />
                        </div>
                    ) : (
                        <h2 className="text-4xl font-black mb-4 text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                           参加者募集中
                        </h2>
                    )}
                    
                    <div className="flex flex-col md:flex-row items-center gap-8 mb-6 bg-slate-800/50 p-6 rounded-3xl border border-slate-700 shadow-xl backdrop-blur-sm">
                        <div className="bg-white p-4 rounded-xl shadow-lg transform rotate-[-2deg] hover:rotate-0 transition duration-500">
                           <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(playerUrl)}`}
                              alt="Join QR"
                              className="w-64 h-64"
                           />
                           <div className="mt-2 text-center text-slate-900 font-mono font-bold text-sm bg-slate-100 py-1 rounded">
                             {playerUrl.replace(/^https?:\/\//, '')}
                           </div>
                        </div>
                        <div className="text-left space-y-4 max-w-md">
                           <div className="space-y-2">
                               <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">1</div>
                                   <p className="text-lg">スマホでQRコードを読み取る</p>
                               </div>
                               <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">2</div>
                                   <p className="text-lg">ニックネームを入力して参加</p>
                               </div>
                               <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">3</div>
                                   <p className="text-lg">ホストの開始を待つ</p>
                               </div>
                           </div>
                        </div>
                    </div>
                    
                    <div className="w-full max-w-6xl flex-1 flex flex-col min-h-0 bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
                        <div className="p-3 bg-slate-800/80 text-center font-bold text-slate-300 border-b border-slate-700 flex justify-between items-center px-6">
                            <span>エントリー済み参加者</span>
                            <span className="bg-indigo-600 text-white px-3 py-0.5 rounded-full text-sm">{state.players.length}名</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                                {sortedPlayers.map((player) => (
                                    <div key={player.id} className={`bg-slate-700/50 p-2 rounded-lg flex items-center gap-2 animate-in fade-in zoom-in duration-300 ${player.isOrganizer ? 'border border-yellow-600/50' : ''}`}>
                                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                                        <span className={`font-bold text-sm truncate ${player.isOrganizer ? 'text-yellow-500' : ''}`}>{player.name}</span>
                                        {player.isOrganizer && <Crown size={12} className="text-yellow-500 ml-auto" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </div>
        )}

        {state.gameState === GameState.PLAYING_QUESTION && (
          <div className="flex-1 flex flex-col p-4 h-full">
            <div className="w-full h-4 bg-slate-800 rounded-full mb-4 overflow-hidden shrink-0">
               <div 
                 className={`h-full transition-all duration-100 ease-linear ${timeLeft < 5 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'}`}
                 style={{ width: `${(timeLeft / state.timeLimit) * 100}%` }}
               />
            </div>
            
            <div className={`w-full flex flex-col items-center justify-center shrink-0 ${currentQuestion?.questionImage ? 'h-[65vh] mb-2' : 'h-auto mb-8'}`}>
               <h2 className={`font-bold leading-tight drop-shadow-md text-center ${currentQuestion?.questionImage ? 'text-2xl mb-2 shrink-0' : 'text-5xl md:text-6xl'}`}>
                  <span className="text-indigo-400 mr-4">Q.{state.currentQuestionIndex + 1}</span>
                  {currentQuestion?.text}
               </h2>
               
               {currentQuestion?.questionImage && (
                   <div className="flex-1 w-full flex justify-center items-center overflow-hidden rounded-xl border-2 border-slate-700 bg-black/50 shadow-lg relative min-h-0">
                        <img 
                            src={currentQuestion.questionImage} 
                            alt="Question" 
                            className="h-full w-full object-contain"
                            referrerPolicy="no-referrer"
                            onError={handleImageError}
                        />
                   </div>
               )}
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4 w-full max-w-7xl mx-auto min-h-0">
               {currentQuestion?.options.map((opt, idx) => {
                 const imgUrl = currentQuestion.optionImages?.[idx];
                 return (
                  <div
                    key={idx}
                    className={`${COLORS[idx]} w-full h-full rounded-2xl shadow-xl flex flex-col items-center justify-center text-white relative overflow-hidden border-2 border-white/10`}
                  >
                     <div className="absolute left-2 top-2 w-10 h-10 bg-black/20 rounded-full flex items-center justify-center font-black text-xl z-10 border-2 border-white/20">
                       {BTN_LABELS[idx]}
                     </div>
                     
                     {imgUrl ? (
                         <>
                            <div className="flex-1 w-full h-full bg-white relative">
                                <img 
                                    src={imgUrl} 
                                    alt={opt} 
                                    className="absolute inset-0 w-full h-full object-contain" 
                                    referrerPolicy="no-referrer"
                                    onError={handleImageError}
                                />
                            </div>
                            {opt && (
                                <div className="w-full bg-black/60 py-1 text-center font-bold text-lg backdrop-blur-sm shrink-0 absolute bottom-0 left-0">
                                    {opt}
                                </div>
                            )}
                         </>
                     ) : (
                         <span className="text-3xl md:text-5xl font-bold text-center px-4 leading-snug drop-shadow-md">{opt}</span>
                     )}
                  </div>
                 );
               })}
            </div>
          </div>
        )}

        {(state.gameState === GameState.PLAYING_RESULT || state.gameState === GameState.FINAL_RESULT) && (
          <div className="flex-1 flex flex-col items-center justify-center relative p-6">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(99,102,241,0.15)_0%,transparent_60%)] animate-pulse-fast"></div>
            </div>

            {state.gameState === GameState.PLAYING_RESULT && (
                <div className="z-10 text-center animate-in zoom-in duration-300 w-full h-full flex flex-col justify-center">
                    <h2 className="text-3xl font-bold text-slate-400 mb-2 uppercase tracking-widest shrink-0">Correct Answer</h2>
                    
                    <div className="flex-1 min-h-0 flex flex-col items-center justify-center mb-4">
                        {currentQuestion?.optionImages?.[currentQuestion.correctIndex] ? (
                             <div className="h-full max-h-[40vh] w-auto aspect-square rounded-xl overflow-hidden border-4 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.4)] bg-white relative">
                                 <img 
                                    src={currentQuestion.optionImages[currentQuestion.correctIndex]} 
                                    alt="Correct Answer" 
                                    className="h-full w-full object-contain"
                                    referrerPolicy="no-referrer"
                                    onError={handleImageError}
                                 />
                                 <div className="absolute bottom-0 inset-x-0 bg-green-600/90 text-white font-bold text-xl py-2">
                                     {currentQuestion?.options[currentQuestion.correctIndex]}
                                 </div>
                             </div>
                        ) : (
                            <div className="text-6xl md:text-8xl font-black text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]">
                                {currentQuestion?.options[currentQuestion.correctIndex]}
                            </div>
                        )}
                    </div>
                    
                    <div className="bg-slate-800/80 backdrop-blur-md p-6 rounded-3xl border border-slate-700 max-w-4xl mx-auto shadow-2xl shrink-0 w-full">
                        <h3 className="text-xl font-bold text-indigo-400 mb-2 flex items-center justify-center gap-2">
                            <Sparkles size={20}/> 解説
                        </h3>
                        <p className="text-xl md:text-2xl text-slate-100 leading-relaxed line-clamp-4">
                            {currentQuestion?.explanation}
                        </p>
                    </div>
                </div>
            )}

            {state.gameState === GameState.FINAL_RESULT && (
                <div className="z-10 w-full max-w-6xl mx-auto">
                    <div className="text-center mb-6">
                        <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 drop-shadow-sm mb-2">
                           FINAL RANKING
                        </h2>
                        <p className="text-xl text-yellow-100/60 font-light tracking-[0.5em] uppercase">Tournament Results</p>
                    </div>

                    <div className="flex justify-center items-end gap-4 h-[50vh] mb-8 px-4 relative">
                        <div className={`w-1/3 max-w-[280px] flex flex-col justify-end transition-all duration-1000 ${state.isRankingResultVisible && state.rankingRevealStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>
                             <div className="text-center mb-2">
                                <div className="text-3xl font-bold text-slate-300 drop-shadow-lg mb-1">{state.isRankingResultVisible ? sortedPlayers[1]?.name : '???'}</div>
                                <div className="text-xl font-mono text-slate-400">{state.isRankingResultVisible ? `${sortedPlayers[1]?.score} pts` : ''}</div>
                             </div>
                             <div className="h-[60%] bg-gradient-to-t from-slate-400 to-slate-300 rounded-t-lg shadow-[0_0_30px_rgba(148,163,184,0.3)] border-t border-white/50 flex flex-col items-center justify-start pt-4 relative">
                                <Medal size={60} className="text-slate-600 drop-shadow-md mb-2" />
                                <div className="text-6xl font-black text-slate-600/50">2</div>
                             </div>
                        </div>

                        <div className={`w-1/3 max-w-[320px] flex flex-col justify-end z-10 -mx-2 transition-all duration-1000 delay-300 ${state.isRankingResultVisible && state.rankingRevealStage >= 3 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-20 scale-95'}`}>
                             <div className="text-center mb-4">
                                <div className="relative inline-block">
                                    <Trophy size={64} className="text-yellow-400 absolute -top-16 left-1/2 -translate-x-1/2 animate-bounce-short drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                                    <div className="text-4xl md:text-5xl font-black text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-1">{state.isRankingResultVisible ? sortedPlayers[0]?.name : '???'}</div>
                                </div>
                                <div className="text-3xl font-mono font-bold text-yellow-100">{state.isRankingResultVisible ? `${sortedPlayers[0]?.score} pts` : ''}</div>
                             </div>
                             <div className="h-[80%] bg-gradient-to-t from-yellow-500 to-yellow-300 rounded-t-xl shadow-[0_0_50px_rgba(234,179,8,0.5)] border-t border-white/50 flex flex-col items-center justify-start pt-8 relative overflow-hidden">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>
                                <div className="text-8xl font-black text-yellow-700/50">1</div>
                             </div>
                        </div>

                        <div className={`w-1/3 max-w-[280px] flex flex-col justify-end transition-all duration-1000 ${state.isRankingResultVisible && state.rankingRevealStage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>
                             <div className="text-center mb-2">
                                <div className="text-3xl font-bold text-amber-600 drop-shadow-lg mb-1">{state.isRankingResultVisible ? sortedPlayers[2]?.name : '???'}</div>
                                <div className="text-xl font-mono text-amber-700">{state.isRankingResultVisible ? `${sortedPlayers[2]?.score} pts` : ''}</div>
                             </div>
                             <div className="h-[45%] bg-gradient-to-t from-amber-700 to-amber-500 rounded-t-lg shadow-[0_0_30px_rgba(217,119,6,0.3)] border-t border-white/50 flex flex-col items-center justify-start pt-4 relative">
                                <Medal size={60} className="text-amber-900 drop-shadow-md mb-2" />
                                <div className="text-6xl font-black text-amber-900/40">3</div>
                             </div>
                        </div>
                    </div>

                    {!state.hideBelowTop3 && sortedPlayers.length > 3 && (
                        <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 border border-slate-700 max-h-[25vh] overflow-y-auto">
                            <h3 className="text-center text-slate-400 text-sm font-bold uppercase mb-4 sticky top-0 bg-slate-800 py-2">Runner Ups</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {sortedPlayers.slice(3).map((player, i) => (
                                    <div key={player.id} className="flex items-center gap-3 bg-slate-700/50 p-2 rounded border border-slate-600">
                                        <div className="bg-slate-600 w-8 h-8 rounded flex items-center justify-center font-bold text-slate-300 text-sm">{i + 4}</div>
                                        <div>
                                            <div className="font-bold text-sm truncate w-24">{player.name}</div>
                                            <div className="text-xs text-slate-400 font-mono">{player.score} pts</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default HostScreen;
