import React, { useState } from 'react';
import { GameState, HostState, Player } from '../types';
import { parseCSVQuiz } from '../services/csvService';
import { Loader2, Users, Trash2, Play, RotateCcw, ChevronRight, Eye, StopCircle, RefreshCw } from 'lucide-react';

interface AdminDashboardProps {
  state: HostState;
  updateState: (updater: (prev: HostState) => HostState) => void;
  resetPlayerAnswers: () => Promise<void>;
  resetPlayerScores: () => Promise<void>;
  kickPlayer: (id: string) => Promise<void>;
  resetAllPlayers: () => Promise<void>;
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  state, updateState, resetPlayerAnswers, resetPlayerScores, kickPlayer, resetAllPlayers, onBack 
}) => {
  const [csvUrl, setCsvUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

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
        currentQuestionIndex: 0
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
      timeLimit: 20 
    }));
  };

  const showResults = () => {
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
        return { ...prev, gameState: GameState.FINAL_RESULT };
      }
      return {
        ...prev,
        currentQuestionIndex: nextIndex,
        gameState: GameState.PLAYING_QUESTION,
        questionStartTime: Date.now()
      };
    });
  };

  const resetGame = () => {
    updateState(prev => ({
      ...prev,
      gameState: GameState.SETUP,
      questions: [],
    }));
    setStatusMsg('ゲームをリセットしました');
  };

  // --- Stats Calculation ---
  const answeredCount = state.players.filter(p => p.lastAnswerIndex !== null && p.lastAnswerIndex !== undefined).length;
  const currentQ = state.questions[state.currentQuestionIndex];

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
                <div className="text-center p-4 bg-slate-50 rounded mb-4">
                   <div className="text-xs text-slate-500 uppercase">現在の問題</div>
                   <div className="text-xl font-bold text-slate-800">第 {state.currentQuestionIndex + 1} 問</div>
                   <div className="text-sm text-slate-600 truncate">{currentQ?.text}</div>
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
                  <button onClick={nextQuestion} className="w-full bg-slate-800 text-white py-4 rounded-lg font-bold text-xl shadow hover:bg-slate-900 flex justify-center items-center gap-2">
                     次の問題へ <ChevronRight/>
                  </button>
                )}

                {state.gameState === GameState.FINAL_RESULT && (
                  <div className="text-center text-yellow-600 font-bold text-lg">
                    全問終了！結果発表中
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PLAYER MANAGEMENT */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
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
               <thead className="bg-slate-50 sticky top-0 text-xs uppercase text-slate-500">
                 <tr>
                   <th className="p-3">名前</th>
                   <th className="p-3">スコア</th>
                   <th className="p-3">現在の回答</th>
                   <th className="p-3 text-right">アクション</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-sm">
                 {state.players.length === 0 ? (
                   <tr><td colSpan={4} className="p-8 text-center text-slate-400">参加者はまだいません</td></tr>
                 ) : (
                   state.players.map(player => {
                     const hasAns = player.lastAnswerIndex !== null && player.lastAnswerIndex !== undefined;
                     return (
                       <tr key={player.id} className="hover:bg-slate-50 group">
                         <td className="p-3 font-bold text-slate-800">
                           <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${player.isOnline !== false ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                             {player.name}
                           </div>
                         </td>
                         <td className="p-3 font-mono">{player.score}</td>
                         <td className="p-3">
                           {hasAns ? (
                             <span className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold">
                               回答済み
                             </span>
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
