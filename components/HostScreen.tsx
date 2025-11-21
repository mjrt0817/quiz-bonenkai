import React, { useState, useEffect, useCallback, memo } from 'react';
import { GameState, HostState, QuizQuestion, BTN_LABELS, COLORS, Player } from '../types';
import { generateQuizQuestions } from '../services/geminiService';
import PlayerScreen from './PlayerScreen';
import { Loader2, Users, Trophy, Play, ChevronRight, CheckCircle, XCircle, Sparkles, QrCode, ExternalLink, Smartphone, X, Clock, Home } from 'lucide-react';
import { db } from '../services/firebaseConfig';
import { ref, set } from 'firebase/database';

interface HostScreenProps {
  state: HostState;
  updateState: (updater: (prev: HostState) => HostState) => void;
  onBack: () => void;
  resetPlayerAnswers?: () => Promise<void>;
  resetPlayerScores?: () => Promise<void>;
}

// Simulator Component
const SimulatedPlayerInstance: React.FC<{
  hostState: HostState;
  onJoin: (player: Player) => void;
  onAnswer: (playerId: string, index: number) => void;
  onBack: () => void;
}> = ({ hostState, onJoin, onAnswer, onBack }) => {
  const simId = "sim-player-01";

  return (
    <PlayerScreen
      state={hostState}
      playerId={simId}
      onJoin={(name) => onJoin({ id: simId, name, score: 0, lastAnswerIndex: null, lastAnswerTime: 0 })}
      onAnswer={(index) => onAnswer(simId, index)}
      onBack={onBack}
    />
  );
};

interface PlayerSimulatorWindowProps {
  hostState: HostState;
  onJoin: (player: Player) => void;
  onAnswer: (playerId: string, index: number) => void;
  onClose: () => void;
}

const PlayerSimulatorWindow: React.FC<PlayerSimulatorWindowProps> = memo(({ hostState, onJoin, onAnswer, onClose }) => (
  <div className="fixed bottom-4 right-4 w-[320px] h-[600px] bg-black rounded-[2.5rem] border-8 border-gray-900 shadow-2xl z-50 overflow-hidden flex flex-col animate-in slide-in-from-bottom-10">
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-xl z-20"></div>
    
    <div className="flex-1 bg-white w-full h-full overflow-hidden relative">
      <SimulatedPlayerInstance 
        hostState={hostState}
        onJoin={onJoin}
        onAnswer={onAnswer}
        onBack={onClose}
      />
    </div>

    <div className="h-12 bg-black flex items-center justify-center relative z-20">
      <div className="w-32 h-1 bg-gray-700 rounded-full mb-2"></div>
      <button 
        onClick={onClose}
        className="absolute right-4 p-1 bg-gray-800 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white transition"
        title="シミュレーターを閉じる"
      >
        <X size={16} />
      </button>
    </div>
  </div>
));

const HostScreen: React.FC<HostScreenProps> = ({ state, updateState, onBack, resetPlayerAnswers, resetPlayerScores }) => {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSimulator, setShowSimulator] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [playerUrl, setPlayerUrl] = useState('');

  // Generate Player URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('role'); // Clear existing role
      url.searchParams.set('role', 'player'); // Set player role
      setPlayerUrl(url.toString());
    }
  }, []);

  // Timer Logic
  useEffect(() => {
    let timerId: any;

    if (state.gameState === GameState.PLAYING_QUESTION && state.questionStartTime) {
      timerId = setInterval(() => {
        const elapsedSeconds = (Date.now() - (state.questionStartTime || 0)) / 1000;
        const remaining = Math.max(0, state.timeLimit - elapsedSeconds);
        
        setTimeLeft(remaining);

        if (remaining <= 0) {
          clearInterval(timerId);
          showResults();
        }
      }, 100);
    } else {
      setTimeLeft(0);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.gameState, state.questionStartTime, state.timeLimit]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const questions = await generateQuizQuestions(topic);
      
      if (!questions || questions.length === 0) {
        throw new Error("クイズが生成されませんでした。別のトピックを試してください。");
      }

      updateState(prev => ({
        ...prev,
        questions,
        gameState: GameState.LOBBY
      }));
    } catch (err) {
      console.error(err);
      setError("クイズの生成に失敗しました。APIキーを確認するか、別のトピックを試してください。");
    } finally {
      setIsLoading(false);
    }
  };

  const startGame = () => {
    // Clear remote DB scores if function is available
    if (resetPlayerScores) {
        resetPlayerScores();
    }

    const resetPlayers = state.players.map(p => ({ ...p, score: 0, lastAnswerIndex: null }));
    
    updateState(prev => ({
      ...prev,
      currentQuestionIndex: 0,
      gameState: GameState.PLAYING_QUESTION,
      players: resetPlayers,
      questionStartTime: Date.now(),
      timeLimit: 20 
    }));
  };

  const showResults = useCallback(() => {
     updateState(prev => {
       if (prev.gameState !== GameState.PLAYING_QUESTION) return prev; 

       const currentQ = prev.questions[prev.currentQuestionIndex];
       const updatedPlayers = prev.players.map(p => {
         // Careful: undefined != null check
         const ans = p.lastAnswerIndex;
         const isCorrect = (ans !== null && ans !== undefined) && ans === currentQ.correctIndex;
         return {
           ...p,
           score: isCorrect ? p.score + 100 : p.score
         };
       });
       
       return {
         ...prev,
         gameState: GameState.PLAYING_RESULT,
         players: updatedPlayers,
         questionStartTime: null 
       };
     });
  }, [updateState]);

  const nextQuestion = () => {
    // Clear remote DB answers for next question
    if (resetPlayerAnswers) {
        resetPlayerAnswers();
    }

    updateState(prev => {
      const nextIndex = prev.currentQuestionIndex + 1;
      if (nextIndex >= prev.questions.length) {
        return { ...prev, gameState: GameState.FINAL_RESULT };
      }
      // Reset answers for next question locally
      const resetPlayers = prev.players.map(p => ({...p, lastAnswerIndex: null}));
      
      return {
        ...prev,
        currentQuestionIndex: nextIndex,
        gameState: GameState.PLAYING_QUESTION,
        players: resetPlayers,
        questionStartTime: Date.now()
      };
    });
  };

  const resetGame = () => {
    updateState(prev => ({
      ...prev,
      gameState: GameState.SETUP,
      questions: [],
      players: [] 
    }));
  };

  // --- SIMULATOR HANDLERS ---
  
  const handleSimJoin = useCallback((player: Player) => {
    // Directly update host state, which syncs to DB
    updateState(prev => {
       const exists = prev.players.find(p => p.id === player.id);
       if (exists) return prev;
       return { ...prev, players: [...prev.players, player] };
    });
  }, [updateState]);

  const handleSimAnswer = useCallback((playerId: string, index: number) => {
    updateState(prev => {
      const updatedPlayers = prev.players.map(p => {
        if (p.id === playerId) {
          return { ...p, lastAnswerIndex: index, lastAnswerTime: Date.now() };
        }
        return p;
      });
      return { ...prev, players: updatedPlayers };
    });
  }, [updateState]);


  // --- RENDER ---

  if (state.gameState === GameState.SETUP) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-6 relative">
        <button onClick={onBack} className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white flex items-center gap-2">
            <Home size={20} /> トップに戻る
        </button>

        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500 mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">クイズを作成</h1>
            <p className="text-slate-400">Powered by Gemini AI</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-left text-sm font-medium text-slate-300 mb-1">クイズのトピック</label>
              <input 
                type="text" 
                value={topic} 
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例: 80年代の音楽, 社員の内輪ネタ..."
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-white"
              />
            </div>
            
            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button 
              onClick={handleGenerate}
              disabled={isLoading || !topic}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : '生成する'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.gameState === GameState.LOBBY) {
    return (
      <div className="flex flex-col h-screen bg-slate-900 text-white">
        <header className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full" title="トップに戻る">
               <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-indigo-400">ロビー</h2>
          </div>
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setShowSimulator(!showSimulator)}
               className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${showSimulator ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
             >
               <Smartphone size={16} />
               {showSimulator ? 'シミュレーターを隠す' : 'プレイヤー画面確認'}
             </button>
             <span className="px-3 py-1 bg-slate-800 rounded-full text-sm text-slate-300">{state.questions.length} 問 準備完了</span>
          </div>
        </header>
        
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="flex flex-col md:flex-row items-center gap-12 mb-8">
            <div className="text-left space-y-6">
               <div>
                 <h1 className="text-6xl font-black mb-2 tracking-wide text-white">参加受付中</h1>
                 <p className="text-2xl text-indigo-300">プレイヤーの参加を待っています...</p>
               </div>
               
               <div className="space-y-3">
                  <div className="flex items-center gap-3 text-slate-400">
                    <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm">1</span>
                    <span>QRコードを読み込む</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400">
                    <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm">2</span>
                    <span>ニックネームを入力して参加</span>
                  </div>
               </div>

               <div className="mt-4 flex flex-col gap-3 items-start">
                 <button 
                   onClick={() => setShowSimulator(true)}
                   className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition shadow-lg w-full md:w-auto justify-center"
                 >
                   <Smartphone size={20} />
                   <span>シミュレーターを開く</span>
                 </button>
                 
                 <a 
                   href={playerUrl || '?role=player'}
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition w-full md:w-auto justify-center"
                 >
                   <ExternalLink size={20} />
                   <span>別タブで参加用画面を開く</span>
                 </a>
               </div>
            </div>

            {/* QR Code Display */}
            <div className="p-6 bg-white rounded-2xl shadow-2xl transform rotate-2 hover:rotate-0 transition duration-500 group">
               <div className="w-48 h-48 bg-white rounded-lg flex flex-col items-center justify-center overflow-hidden border-4 border-slate-900">
                 {playerUrl ? (
                   <img 
                     src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(playerUrl)}`}
                     alt="Join QR Code"
                     className="w-full h-full object-cover"
                   />
                 ) : (
                   <QrCode size={80} className="text-slate-900" />
                 )}
               </div>
               <div className="mt-4 text-center">
                 <p className="font-bold text-slate-900 text-lg">スキャンして参加</p>
                 {playerUrl && (
                   <p className="text-xs text-slate-500 mt-1 break-all max-w-[200px] mx-auto">{playerUrl}</p>
                 )}
               </div>
            </div>
          </div>

          <div className="w-full max-w-5xl">
            <h3 className="text-left text-slate-500 font-bold mb-4 border-b border-slate-800 pb-2">
               参加者 ({state.players.length}名)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {state.players.map(player => (
                <div key={player.id} className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex items-center gap-3 animate-bounce-short">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-xs">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold truncate text-sm">{player.name}</span>
                </div>
              ))}
              {state.players.length === 0 && (
                <div className="col-span-full text-slate-600 py-4 italic">
                   待機中...
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="p-6 border-t border-slate-800 flex justify-center bg-slate-900/50 backdrop-blur-sm sticky bottom-0 z-40">
          <button 
            onClick={startGame}
            disabled={state.players.length === 0}
            className="px-12 py-4 bg-green-500 hover:bg-green-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black text-2xl rounded-full shadow-[0_0_40px_rgba(34,197,94,0.3)] hover:shadow-[0_0_60px_rgba(34,197,94,0.5)] transition transform hover:scale-105 flex items-center gap-3"
          >
            <Play size={28} fill="currentColor" /> クイズ開始
          </button>
        </footer>

        {showSimulator && (
          <PlayerSimulatorWindow 
            hostState={state}
            onJoin={handleSimJoin}
            onAnswer={handleSimAnswer}
            onClose={() => setShowSimulator(false)}
          />
        )}
      </div>
    );
  }

  const currentQ = state.questions[state.currentQuestionIndex];
  const answerCount = state.players.filter(p => p.lastAnswerIndex !== null && p.lastAnswerIndex !== undefined).length;
  const totalPlayers = state.players.length;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white">
      
      {state.gameState === GameState.PLAYING_QUESTION && (
        <div className="h-2 bg-slate-800 w-full relative overflow-hidden">
           <div 
             className="h-full bg-indigo-500 transition-all ease-linear duration-100"
             style={{ width: `${(timeLeft / state.timeLimit) * 100}%` }}
           />
        </div>
      )}

      <header className="bg-slate-900 p-4 flex justify-between items-center border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full" title="終了する">
              <X size={16} />
          </button>
          <span className="text-slate-400 font-medium">第 {state.currentQuestionIndex + 1} 問 / {state.questions.length}</span>
          {state.gameState === GameState.PLAYING_QUESTION && (
             <span className="px-3 py-1 bg-blue-900/50 text-blue-200 rounded-full text-sm font-bold flex items-center gap-2">
               <Users size={14} /> 回答: {answerCount} / {totalPlayers}
             </span>
          )}
        </div>
        <div className="flex items-center gap-4">
           {state.gameState === GameState.PLAYING_QUESTION && (
              <div className={`text-2xl font-mono font-bold flex items-center gap-2 ${timeLeft < 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                 <Clock size={24} />
                 {Math.ceil(timeLeft)}秒
              </div>
           )}
           <button 
             onClick={() => setShowSimulator(!showSimulator)}
             className={`p-2 rounded-full transition ${showSimulator ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
             title="シミュレーター表示切替"
           >
             <Smartphone size={20} />
           </button>
           <div className="text-indigo-400 font-bold tracking-widest hidden md:block">HOST VIEW</div>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-6 max-w-6xl mx-auto w-full relative z-0">
        
        {state.gameState === GameState.FINAL_RESULT ? (
           <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
             <Trophy size={80} className="text-yellow-400 mb-6 drop-shadow-lg" />
             <h1 className="text-5xl font-black mb-12 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600">最終結果</h1>
             <div className="w-full max-w-2xl space-y-4">
               {state.players.sort((a, b) => b.score - a.score).map((player, idx) => (
                 <div key={player.id} className={`flex items-center p-6 rounded-2xl border-2 shadow-xl ${idx === 0 ? 'bg-yellow-900/30 border-yellow-500/50' : 'bg-slate-800 border-slate-700'}`}>
                   <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl mr-6 ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : 'bg-slate-600 text-slate-200'}`}>
                     {idx + 1}
                   </div>
                   <div className="flex-1">
                     <h3 className="text-2xl font-bold">{player.name}</h3>
                   </div>
                   <div className="text-3xl font-mono font-bold text-indigo-300">
                     {player.score} pts
                   </div>
                 </div>
               ))}
             </div>
             <button onClick={resetGame} className="mt-12 text-slate-400 hover:text-white underline">新しくクイズを作る</button>
           </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight drop-shadow-sm">
                {currentQ.text}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              {currentQ.options.map((opt, idx) => {
                const isReveal = state.gameState === GameState.PLAYING_RESULT;
                const isCorrect = idx === currentQ.correctIndex;
                
                let cardClass = `relative p-8 rounded-xl border-2 transition-all duration-300 flex items-center overflow-hidden group `;
                
                if (isReveal) {
                  if (isCorrect) {
                    cardClass += `bg-green-600 border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.4)] scale-105 opacity-100`;
                  } else {
                    cardClass += `bg-slate-800 border-slate-700 opacity-40 grayscale`;
                  }
                } else {
                   cardClass += `bg-slate-800 border-slate-700 text-slate-200`;
                }

                return (
                  <div key={idx} className={cardClass}>
                    <div className={`absolute left-0 top-0 bottom-0 w-3 ${COLORS[idx].split(' ')[0]}`} />
                    
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg mr-4 z-10 ${isReveal && isCorrect ? 'bg-white text-green-600' : 'bg-slate-700 text-slate-300'}`}>
                      {BTN_LABELS[idx]}
                    </div>
                    
                    <span className="text-xl md:text-2xl font-semibold z-10">{opt}</span>
                    
                    {isReveal && isCorrect && (
                      <CheckCircle className="absolute right-4 text-white opacity-50 w-12 h-12" />
                    )}
                  </div>
                );
              })}
            </div>

            {state.gameState === GameState.PLAYING_RESULT && (
              <div className="mt-6 p-6 bg-indigo-900/30 border border-indigo-500/30 rounded-xl text-indigo-200 animate-in slide-in-from-bottom-4">
                <p className="font-bold mb-1 flex items-center gap-2"><Sparkles size={18} /> 解説:</p>
                <p>{currentQ.explanation}</p>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="p-4 bg-slate-900 border-t border-slate-800 flex justify-center gap-4 relative z-10">
        {state.gameState === GameState.PLAYING_QUESTION && (
          <button 
            onClick={showResults}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-lg shadow-lg transition w-full md:w-auto"
          >
            答えを表示
          </button>
        )}
        
        {state.gameState === GameState.PLAYING_RESULT && (
          <button 
            onClick={nextQuestion}
            className="px-8 py-3 bg-white text-slate-900 hover:bg-slate-200 font-bold rounded-lg text-lg shadow-lg transition flex items-center gap-2 w-full md:w-auto justify-center"
          >
            次の問題へ <ChevronRight />
          </button>
        )}
      </footer>

      {showSimulator && (
        <PlayerSimulatorWindow 
          hostState={state}
          onJoin={handleSimJoin}
          onAnswer={handleSimAnswer}
          onClose={() => setShowSimulator(false)}
        />
      )}
    </div>
  );
};

export default HostScreen;
