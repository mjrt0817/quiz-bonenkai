import React, { useState, useMemo } from 'react';
import { GameState, HostState, Player } from '../types';
import { parseCSVQuiz } from '../services/csvService';
import { Loader2, Users, Trash2, Play, RotateCcw, ChevronRight, Eye, StopCircle, RefreshCw, Medal, Trophy, EyeOff } from 'lucide-react';

interface AdminDashboardProps {
  state: HostState;
  updateState: (updater: (prev: HostState) => HostState) => void;
  resetPlayerAnswers: () => Promise<void>;
  resetPlayerScores: () => Promise<void>;
  calculateAndSaveScores: () => Promise<void>;
  kickPlayer: (id: string) => Promise<void>;
  resetAllPlayers: () => Promise<void>;
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  state, updateState, resetPlayerAnswers, resetPlayerScores, calculateAndSaveScores, kickPlayer, resetAllPlayers, onBack 
}) => {
  const [csvUrl, setCsvUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Optimize player sorting using useMemo to prevent re-calculations on every render
  const sortedPlayers = useMemo(() => {
    return [...state.players].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.name.localeCompare(b.name);
    });
  }, [state.players]);

  // --- Game Control Functions ---
  
  const loadQuestions = async () => {
    if (!csvUrl) return;
    setIsLoading(true);
    setStatusMsg('');
    try {
      const questions = await parseCSVQuiz(csvUrl);
      updateState(prev => ({
        ...prev,
        questions,
        gameState: GameState.LOBBY,
        currentQuestionIndex: 0,
        rankingRevealStage: 0,
        hideBelowTop3: false
      }));
      setStatusMsg(`読み込み成功！ ${questions.length}問セットされました。`);
    } catch (err: any) {
      setStatusMsg(`エラー: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startGame = () => {
    resetPlayerScores();
    updateState(prev => ({
      ...prev,
      currentQuestionIndex: 0,
      gameState: GameState.PLAYING_QUESTION,
      questionStartTime: Date.now(),
      timeLimit: 20,
      rankingRevealStage: 0
    }));
  };

  const showResults = async () => {
    // 1. Calculate scores first
    await calculateAndSaveScores();
    
    // 2. Then change state to show results
    updateState(prev => ({
      ...prev,
      gameState: GameState.PLAYING_RESULT,
      questionStartTime: null 
    }));
  };

  const nextQuestion = () => {
    resetPlayerAnswers();
    updateState(prev => {
      const nextIndex = prev.currentQuestionIndex + 1;
      if (nextIndex >= prev.questions.length) {
        return { 
            ...prev, 
            gameState: GameState.FINAL_RESULT,
            rankingRevealStage: 0 // Start with stage 0 (4th place and below)
        };
      }
      return {
        ...prev,
        currentQuestionIndex: nextIndex,
        gameState: GameState.PLAYING_QUESTION,
        questionStartTime: Date.now()
      };
    });
  };

  const nextRankingStage = () => {
      updateState(prev => {
          const nextStage = prev.rankingRevealStage + 1;
          return { ...prev, rankingRevealStage: nextStage };
      });
  };
  
  const toggleHideBelowTop3 = () => {
      updateState(prev => ({ ...prev, hideBelowTop3: !prev.hideBelowTop3 }));
  };

  const resetGame = () => {
    updateState(prev => ({
      ...prev,
      gameState: GameState.SETUP,
      questions: [],
      rankingRevealStage: 0,
      hideBelowTop3: false
    }));
    setStatusMsg('ゲームをリセットしました');
  };

  // --- Stats Calculation ---
  const answeredCount = state.players.filter(p => p.lastAnswerIndex !== null && p.lastAnswerIndex !== undefined).length;
  // Safe access
  const currentQ = state.questions && state.questions[state.currentQuestionIndex] 
    ? state.questions[state.currentQuestionIndex]
    : { text: "", options: [] };

  const isFinalQuestion = state.questions.length > 0 && state.currentQuestionIndex === state.questions.length - 1;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-4">
           <h1 className="text-xl font-bold bg-red-600 px-3 py-1 rounded">ADMIN MODE</h1>
           <span className="text-slate-400 text-sm">Status: {state.gameState}</span>
        </div>
        <button onClick={onBack} className="text-sm hover:underline text-slate-300">終了する</button>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: CONTROLS */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Qr Code for Admin Ref */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
             <p className="text-xs text-slate-500 mb-2">プレイヤー参加用URL</p>
             <div className="bg-slate-100 p-2 rounded text-xs font-mono truncate select-all">
               {typeof window !== 'undefined' ? window.location.href.replace('role=admin', 'role=player') : ''}
             </div>
          </div>

          {/* 1. Setup Panel */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-700"><RefreshCw size={20}/> クイズ読み込み</h2>
            {state.questions.length === 0 ? (
              <div className="space-y-3">
                <input 
                  type="text" 
                  value={csvUrl}
                  onChange={(e) => setCsvUrl(e.target.value)}
                  placeholder="CSVの公開URLを貼り付け"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
                <p className="text-xs text-slate-500">※ スプレッドシートを「ウェブに公開(CSV)」してURLを取得してください</p>
                <button 
                  onClick={loadQuestions}
                  disabled={isLoading || !csvUrl}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-bold text-sm"
                >
                  {isLoading ? <Loader2 className="animate-spin mx-auto"/> : 'ロード'}
                </button>
                {statusMsg && <p className="text-xs font-bold text-red-500">{statusMsg}</p>}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-bold text-green-600">✅ {state.questions.length}問 ロード済み</p>
                <button onClick={resetGame} className="w-full border border-slate-300 py-2 rounded text-xs hover:bg-slate-50">
                  クイズデータを破棄してリセット
                </button>
              </div>
            )}
          </div>

          {/* 2. Game Control Panel */}
          {state.questions.length > 0 && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-indigo-500">
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-700"><Play size={20}/> 進行コントロール</h2>
              
              <div className="space-y-4">
                <div className="text-center p-4 bg-slate-50 rounded mb-4 relative overflow-hidden">
                   <div className="text-xs text-slate-500 uppercase">現在の問題</div>
                   <div className="text-xl font-bold text-slate-800">第 {state.currentQuestionIndex + 1} 問</div>
                   <div className="text-sm text-slate-600 truncate">{currentQ.text}</div>
                   
                   {isFinalQuestion && state.gameState !== GameState.FINAL_RESULT && (
                     <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-2 py-1">FINAL</div>
                   )}
                </div>

                {/* Global Options: Always visible when questions are loaded */}
                <div className="mb-4">
                    <button 
                        onClick={toggleHideBelowTop3}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border transition ${state.hideBelowTop3 ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                    >
                        {state.hideBelowTop3 ? <EyeOff size={16}/> : <Eye size={16}/>}
                        {state.hideBelowTop3 ? '最終結果で4位以下を隠す (ON)' : '最終結果で4位以下を表示 (OFF)'}
                    </button>
                    <p className="text-[10px] text-slate-400 text-center mt-1">※最終結果発表時の表示設定</p>
                </div>

                {state.gameState === GameState.LOBBY && (
                  <button onClick={startGame} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-xl shadow hover:bg-green-700">
                     クイズ開始！
                  </button>
                )}

                {state.gameState === GameState.PLAYING_QUESTION && (
                  <button onClick={showResults} className="w-full bg-indigo-600 text-white py-4 rounded-lg font-bold text-xl shadow hover:bg-indigo-700">
                     正解を表示 (締め切り)
                  </button>
                )}

                {state.gameState === GameState.PLAYING_RESULT && (
                  <button onClick={nextQuestion} className={`w-full text-white py-4 rounded-lg font-bold text-xl shadow flex justify-center items-center gap-2 ${isFinalQuestion ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-900'}`}>
                     {isFinalQuestion ? '最終結果へ' : '次の問題へ'} <ChevronRight/>
                  </button>
                )}

                {state.gameState === GameState.FINAL_RESULT && (
                  <div className="space-y-4">
                    <div className="text-center text-yellow-600 font-bold text-lg mb-2">
                      最終結果発表中
                    </div>
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-center mb-2">
                        Current Stage: 
                        <span className="font-bold ml-2">
                            {state.rankingRevealStage === 0 ? '4位以下' : 
                             state.rankingRevealStage === 1 ? '3位発表' : 
                             state.rankingRevealStage === 2 ? '2位発表' : '1位発表'}
                        </span>
                    </div>
                    
                    {state.rankingRevealStage < 3 ? (
                        <button onClick={nextRankingStage} className="w-full bg-yellow-500 text-white py-3 rounded shadow hover:bg-yellow-600 font-bold flex items-center justify-center gap-2">
                            <Medal size={20}/> 
                            {state.rankingRevealStage === 0 ? '3位を発表' : 
                             state.rankingRevealStage === 1 ? '2位を発表' : '優勝者を発表'}
                        </button>
                    ) : (
                        <button disabled className="w-full bg-slate-300 text-slate-500 py-3 rounded font-bold">
                            発表終了
                        </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PLAYER MANAGEMENT */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[80vh]">
           <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2 text-slate-700">
                <Users size={20}/> 参加者管理 ({state.players.length}名)
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={resetPlayerScores}
                  className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100"
                >
                  スコアリセット
                </button>
                <button 
                  onClick={() => {
                     if(confirm('本当に全員のデータを削除して強制退場させますか？')) resetAllPlayers();
                  }}
                  className="px-3 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                >
                  全員キック
                </button>
              </div>
           </div>

           <div className="flex-1 overflow-auto p-0">
             <table className="w-full text-left border-collapse">
               <thead className="bg-slate-50 sticky top-0 text-xs uppercase text-slate-500 z-10">
                 <tr>
                   <th className="p-3">名前</th>
                   <th className="p-3">スコア</th>
                   <th className="p-3">現在の回答</th>
                   <th className="p-3 text-right">アクション</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-sm">
                 {sortedPlayers.length === 0 ? (
                   <tr><td colSpan={4} className="p-8 text-center text-slate-400">参加者はまだいません</td></tr>
                 ) : (
                   sortedPlayers.map((player, index) => {
                     const hasAns = player.lastAnswerIndex !== null && player.lastAnswerIndex !== undefined;
                     // Check correctness if needed (only during result)
                     const isCorrect = state.gameState === GameState.PLAYING_RESULT && player.lastAnswerIndex === state.questions[state.currentQuestionIndex].correctIndex;

                     return (
                       <tr key={player.id} className="hover:bg-slate-50 group">
                         <td className="p-3 font-bold text-slate-800">
                           <div className="flex items-center gap-2">
                             <span className="w-5 text-slate-400 text-xs">{index + 1}</span>
                             <div className={`w-2 h-2 rounded-full ${player.isOnline !== false ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                             {player.name}
                           </div>
                         </td>
                         <td className="p-3 font-mono font-bold text-indigo-600">{player.score}</td>
                         <td className="p-3">
                           {hasAns ? (
                             state.gameState === GameState.PLAYING_RESULT ? (
                                 <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                     {isCorrect ? '正解' : '不正解'}
                                 </span>
                             ) : (
                                 <span className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold">
                                     回答済み
                                 </span>
                             )
                           ) : (
                             <span className="text-slate-400 text-xs">-</span>
                           )}
                         </td>
                         <td className="p-3 text-right">
                           <button 
                             onClick={() => {
                               if(confirm(`${player.name}を退場させますか？`)) kickPlayer(player.id);
                             }}
                             className="p-1 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                             title="キック"
                           >
                             <Trash2 size={16} />
                           </button>
                         </td>
                       </tr>
                     );
                   })
                 )}
               </tbody>
             </table>
           </div>
           <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex justify-between">
             <span>現在の回答率: {Math.round((answeredCount / (state.players.length || 1)) * 100)}%</span>
             <span>Room: {state.roomCode}</span>
           </div>
        </div>

      </main>
    </div>
  );
};

export default AdminDashboard;
