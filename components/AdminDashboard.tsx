import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GameState, HostState, Player } from '../types';
import { parseCSVQuiz } from '../services/csvService';
import { Loader2, Users, Trash2, Play, RotateCcw, ChevronRight, Eye, StopCircle, RefreshCw, Medal, Trophy, EyeOff, Type, Clock, Lock, Unlock, Music, Upload, Volume2, Pause, Repeat, Image as ImageIcon, X, QrCode, Terminal, Monitor } from 'lucide-react';

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

interface SoundSlot {
  id: number;
  file: File | null;
  url: string | null;
  isPlaying: boolean;
  isLoop: boolean;
  volume: number;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  state, updateState, resetPlayerAnswers, resetPlayerScores, calculateAndSaveScores, kickPlayer, resetAllPlayers, onBack 
}) => {
  const [csvUrl, setCsvUrl] = useState('');
  const [titleInput, setTitleInput] = useState(state.quizTitle || 'クイズ大会');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'PLAYERS' | 'QUIZ'>('PLAYERS');

  // Helper to add log
  const addLog = (msg: string) => {
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  // Sound Board State
  const [soundSlots, setSoundSlots] = useState<SoundSlot[]>(
    Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      file: null,
      url: null,
      isPlaying: false,
      isLoop: false,
      volume: 1.0,
    }))
  );
  
  // Refs to hold Audio objects - Initialize with array of 6 nulls safely
  const audioRefs = useRef<(HTMLAudioElement | null)[]>(new Array(6).fill(null));

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      soundSlots.forEach(slot => {
        if (slot.url) URL.revokeObjectURL(slot.url);
      });
      if (audioRefs.current) {
        audioRefs.current.forEach(audio => {
          if (audio) {
            audio.pause();
            audio.src = '';
            audio.onended = null;
            audio.onerror = null;
          }
        });
      }
    };
  }, []);

  useEffect(() => {
    if(state.quizTitle) setTitleInput(state.quizTitle);
  }, [state.quizTitle]);

  // Optimize player sorting using useMemo to prevent re-calculations on every render
  const sortedPlayers = useMemo(() => {
    try {
        // Safety check: ensure players is an array
        const players = Array.isArray(state.players) ? state.players : [];
        
        // Filter out null/undefined players to prevent crash
        const validPlayers = players.filter(p => p && typeof p === 'object' && p.id);
        
        return [...validPlayers].sort((a, b) => {
            const scoreA = typeof a.score === 'number' ? a.score : 0;
            const scoreB = typeof b.score === 'number' ? b.score : 0;
            if (scoreB !== scoreA) return scoreB - scoreA;
            
            // Tie-breaker: Faster total time wins (smaller value)
            const timeA = typeof a.totalResponseTime === 'number' ? a.totalResponseTime : 0;
            const timeB = typeof b.totalResponseTime === 'number' ? b.totalResponseTime : 0;
            if (timeA !== timeB) return timeA - timeB;
            
            const nameA = a.name ? String(a.name) : '';
            const nameB = b.name ? String(b.name) : '';
            return nameA.localeCompare(nameB);
        });
    } catch (e: any) {
        console.error("Sort error", e);
        setDebugError(`Sort Error: ${e.message}`);
        return [];
    }
  }, [state.players]);

  // SAFELY calculate answered count. 
  const answeredCount = useMemo(() => {
    try {
        const list = Array.isArray(state.players) ? state.players : [];
        return list.filter(p => p && p.lastAnswerIndex !== null && p.lastAnswerIndex !== undefined).length;
    } catch (e) {
        return 0;
    }
  }, [state.players]);

  // --- Image Upload Function ---
  const handleTitleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit check
          alert("画像サイズが大きすぎます。1MB以下の画像を選択してください。");
          return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        updateState(prev => ({ ...prev, titleImage: base64 }));
        addLog("大会画像をアップロードしました");
      };
      reader.readAsDataURL(file);
    }
  };

  const clearTitleImage = () => {
    updateState(prev => ({ ...prev, titleImage: null }));
    addLog("大会画像をクリアしました");
  };


  // --- Sound Board Functions ---
  const handleFileSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 1. Stop and cleanup old audio if exists
      if (audioRefs.current && audioRefs.current[index]) {
        const oldAudio = audioRefs.current[index];
        if (oldAudio) {
            oldAudio.pause();
            oldAudio.src = '';
            oldAudio.onended = null;
            oldAudio.onerror = null;
        }
        audioRefs.current[index] = null;
      }

      // 2. Cleanup old URL
      const oldSlot = soundSlots[index];
      if (oldSlot.url) {
        URL.revokeObjectURL(oldSlot.url);
      }
      
      // 3. Create new URL
      const url = URL.createObjectURL(file);
      
      setSoundSlots(prev => prev.map((slot, i) => 
        i === index ? { ...slot, file, url, isPlaying: false } : slot
      ));
      addLog(`Slot #${index + 1}: ファイルをセットしました (${file.name})`);
    }
  };

  const togglePlaySound = (index: number) => {
    try {
        const slot = soundSlots[index];
        if (!slot.url) return;
        
        // Ensure refs array is initialized
        if (!audioRefs.current) {
            audioRefs.current = new Array(6).fill(null);
        }

        let audio = audioRefs.current[index];

        // Create audio instance if missing
        if (!audio) {
            audio = new Audio(slot.url);
            audioRefs.current[index] = audio;
        }

        // Apply settings
        audio.volume = slot.volume;
        audio.loop = slot.isLoop;

        // Cleanup handlers
        audio.onended = null;
        audio.onerror = null;

        audio.onended = () => {
             // If looping, do not stop UI
             if (audio.loop) return;
             setSoundSlots(prev => prev.map((s, i) => i === index ? { ...s, isPlaying: false } : s));
        };

        audio.onerror = (e) => {
            console.error(`Audio error slot ${index}`, e);
            addLog(`Slot #${index + 1} Error: 再生失敗`);
            setSoundSlots(prev => prev.map((s, i) => i === index ? { ...s, isPlaying: false } : s));
        };

        // --- Playback Control ---
        if (slot.isPlaying) {
            // Restart (Pon-dashi)
            audio.currentTime = 0;
            audio.play().catch(e => {
                 console.error("Replay error", e);
                 addLog(`Replay Error: ${e.message}`);
                 // If error, force stop UI
                 setSoundSlots(prev => prev.map((s, i) => i === index ? { ...s, isPlaying: false } : s));
            });
        } else {
            // Start
            audio.currentTime = 0; // Ensure start from beginning
            const playPromise = audio.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.error("Play error", e);
                    addLog(`Play Error: ${e.message}`);
                    setSoundSlots(prev => prev.map((s, i) => i === index ? { ...s, isPlaying: false } : s));
                });
            }
            
            // Update UI to playing
            setSoundSlots(prev => prev.map((s, i) => i === index ? { ...s, isPlaying: true } : s));
        }
        
    } catch (e: any) {
        addLog(`Sound Logic Error: ${e.message}`);
        setSoundSlots(prev => prev.map((s, i) => i === index ? { ...s, isPlaying: false } : s));
    }
  };

  const stopSound = (index: number) => {
    const audio = audioRefs.current?.[index];
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setSoundSlots(prev => prev.map((s, i) => i === index ? { ...s, isPlaying: false } : s));
  };

  const toggleLoop = (index: number) => {
     setSoundSlots(prev => prev.map((s, i) => {
         if (i !== index) return s;
         const newLoop = !s.isLoop;
         // Apply immediately if audio exists
         if (audioRefs.current && audioRefs.current[index]) {
             audioRefs.current[index]!.loop = newLoop;
         }
         return { ...s, isLoop: newLoop };
     }));
  };

  // --- Game Control Functions ---
  
  const loadQuestions = async () => {
    if (!csvUrl) return;
    setIsLoading(true);
    addLog('CSV読み込み開始...');
    
    try {
      const questions = await parseCSVQuiz(csvUrl);
      
      // Validation check to prevent crash
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error("有効な問題データが見つかりませんでした。");
      }

      updateState(prev => ({
        ...prev,
        questions,
        gameState: GameState.LOBBY,
        currentQuestionIndex: 0,
        rankingRevealStage: 0,
        isRankingResultVisible: false,
        hideBelowTop3: false,
        // Keep current visibility setting
        quizTitle: titleInput
      }));
      addLog(`成功！ ${questions.length}問をロードしました`);
    } catch (err: any) {
      console.error("Load Error:", err);
      // Safe error message
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`読み込みエラー: ${msg}`);
      alert(`読み込みエラー: ${msg}`);
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
      rankingRevealStage: 0,
      isRankingResultVisible: false
    }));
    addLog("クイズを開始しました");
  };

  const showResults = async () => {
    addLog("回答締め切り・集計中...");
    await calculateAndSaveScores();
    
    updateState(prev => ({
      ...prev,
      gameState: GameState.PLAYING_RESULT,
      questionStartTime: null 
    }));
    addLog("正解を表示しました");
  };

  const nextQuestion = () => {
    resetPlayerAnswers();
    updateState(prev => {
      const nextIndex = prev.currentQuestionIndex + 1;
      if (nextIndex >= prev.questions.length) {
        addLog("最終結果画面へ移行");
        return { 
            ...prev, 
            gameState: GameState.FINAL_RESULT,
            rankingRevealStage: 0, 
            isRankingResultVisible: false
        };
      }
      addLog(`第${nextIndex + 1}問へ移行`);
      return {
        ...prev,
        currentQuestionIndex: nextIndex,
        gameState: GameState.PLAYING_QUESTION,
        questionStartTime: Date.now()
      };
    });
  };

  const goToStage = (stage: number) => {
      updateState(prev => ({ 
          ...prev, 
          rankingRevealStage: stage, 
          isRankingResultVisible: false 
      }));
  };

  const revealStage = () => {
      updateState(prev => ({ ...prev, isRankingResultVisible: true }));
  };
  
  const toggleHideBelowTop3 = () => {
      updateState(prev => ({ ...prev, hideBelowTop3: !prev.hideBelowTop3 }));
  };
  
  const toggleLobbyDetails = () => {
    updateState(prev => ({ ...prev, isLobbyDetailsVisible: !prev.isLobbyDetailsVisible }));
  };

  const resetGame = () => {
    updateState(prev => ({
      ...prev,
      gameState: GameState.SETUP,
      questions: [],
      rankingRevealStage: 0,
      isRankingResultVisible: false,
      hideBelowTop3: false,
      isLobbyDetailsVisible: false
    }));
    addLog("ゲームをリセットしました");
  };

  // Safe access with fallbacks to prevent crash
  const currentQ = (state.questions && state.questions[state.currentQuestionIndex]) 
    ? state.questions[state.currentQuestionIndex]
    : { text: "Loading...", options: [] };

  const isFinalQuestion = state.questions && state.questions.length > 0 && state.currentQuestionIndex === state.questions.length - 1;

  // Render logic for ranking buttons
  const renderRankingControl = () => {
      const stage = state.rankingRevealStage;
      const visible = state.isRankingResultVisible;

      if (stage === 0) {
          return (
             <button onClick={() => goToStage(1)} className="w-full bg-amber-600 text-white py-4 rounded-lg font-bold text-xl shadow hover:bg-amber-700 flex items-center justify-center gap-2">
                 <Medal size={24}/> 3位の発表準備 (READY)
             </button>
          );
      } else if (stage === 1) {
          if (!visible) {
              return (
                 <button onClick={revealStage} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-xl shadow hover:bg-green-700 flex items-center justify-center gap-2 animate-pulse">
                     <Unlock size={24}/> 3位をオープン (OPEN)
                 </button>
              );
          } else {
              return (
                 <button onClick={() => goToStage(2)} className="w-full bg-slate-600 text-white py-4 rounded-lg font-bold text-xl shadow hover:bg-slate-700 flex items-center justify-center gap-2">
                     <Medal size={24}/> 2位の発表準備 (READY)
                 </button>
              );
          }
      } else if (stage === 2) {
          if (!visible) {
              return (
                 <button onClick={revealStage} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-xl shadow hover:bg-green-700 flex items-center justify-center gap-2 animate-pulse">
                     <Unlock size={24}/> 2位をオープン (OPEN)
                 </button>
              );
          } else {
              return (
                 <button onClick={() => goToStage(3)} className="w-full bg-yellow-600 text-white py-4 rounded-lg font-bold text-xl shadow hover:bg-yellow-700 flex items-center justify-center gap-2">
                     <Trophy size={24}/> 優勝者の発表準備 (READY)
                 </button>
              );
          }
      } else if (stage === 3) {
          if (!visible) {
               return (
                 <button onClick={revealStage} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-xl shadow hover:bg-green-700 flex items-center justify-center gap-2 animate-pulse">
                     <Unlock size={24}/> 優勝者をオープン (OPEN)
                 </button>
              );
          } else {
              return (
                 <button disabled className="w-full bg-slate-300 text-slate-500 py-4 rounded-lg font-bold text-xl shadow flex items-center justify-center gap-2">
                     発表終了
                 </button>
              );
          }
      }
      return null;
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans pb-20">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-4">
           <h1 className="text-xl font-bold bg-red-600 px-3 py-1 rounded">ADMIN MODE</h1>
           <span className="text-slate-400 text-sm hidden sm:inline">Status: {state.gameState}</span>
           <span className="text-slate-400 text-sm border-l border-slate-700 pl-4 hidden sm:inline">Title: {state.quizTitle}</span>
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
               {typeof window !== 'undefined' ? `${window.location.origin}/player` : ''}
             </div>
          </div>

          {/* NEW: Display Control (Visible in SETUP/LOBBY) */}
          {(state.gameState === GameState.SETUP || state.gameState === GameState.LOBBY) && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
               <h2 className="font-bold text-lg mb-3 text-slate-700 flex items-center gap-2"><Monitor size={20}/> 画面表示</h2>
               <button onClick={toggleLobbyDetails} className={`w-full py-3 rounded-lg font-bold text-sm border flex items-center justify-center gap-2 transition ${state.isLobbyDetailsVisible ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}>
                   {state.isLobbyDetailsVisible ? <ImageIcon size={18}/> : <QrCode size={18}/>}
                   {state.isLobbyDetailsVisible ? 'タイトル画像モードへ' : 'QR・参加者モードへ'}
               </button>
               <p className="text-[10px] text-slate-400 mt-2 text-center">
                   プロジェクター画面の表示を切り替えます
               </p>
            </div>
          )}

          {/* 1. Setup Panel */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-700"><RefreshCw size={20}/> クイズ読み込み</h2>
            {state.questions.length === 0 ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">大会タイトル</label>
                  <div className="flex items-center gap-2">
                    <Type size={16} className="text-slate-400"/>
                    <input 
                      type="text" 
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      placeholder="例: 2024 忘年会クイズ"
                      className="w-full px-3 py-2 border rounded text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">大会ロゴ/画像 (任意)</label>
                  <div className="flex items-center gap-2">
                    {!state.titleImage ? (
                      <label className="flex items-center justify-center w-full p-2 border-2 border-dashed rounded cursor-pointer hover:bg-slate-50 text-slate-500 text-xs gap-2">
                          <ImageIcon size={16}/> <span>画像を選択 (Max 1MB)</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleTitleImageUpload} />
                      </label>
                    ) : (
                      <div className="flex items-center justify-between w-full p-2 border rounded bg-slate-50">
                          <span className="text-xs text-green-600 font-bold flex items-center gap-1"><ImageIcon size={14}/> 画像セット済み</span>
                          <button onClick={clearTitleImage} className="text-red-500 hover:text-red-700"><X size={16}/></button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1 border-t pt-3">
                  <label className="text-xs font-bold text-slate-500">CSV URL</label>
                  <input 
                    type="text" 
                    value={csvUrl}
                    onChange={(e) => setCsvUrl(e.target.value)}
                    placeholder="スプレッドシートのURLを貼り付け"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
                <p className="text-xs text-slate-500">※ 通常の編集用URLでも、CSV公開用URLでもOKです</p>
                <button 
                  onClick={loadQuestions}
                  disabled={isLoading || !csvUrl}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-bold text-sm"
                >
                  {isLoading ? <Loader2 className="animate-spin mx-auto"/> : 'ロード'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-bold text-green-600">✅ {state.questions.length}問 ロード済み</p>
                <p className="text-xs text-slate-500">Title: {state.quizTitle}</p>
                <button onClick={resetGame} className="w-full border border-slate-300 py-2 rounded text-xs hover:bg-slate-50 text-slate-600">
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
                   <div className="text-sm text-slate-600 truncate">{currentQ?.text || 'Error'}</div>
                   
                   {isFinalQuestion && state.gameState !== GameState.FINAL_RESULT && (
                     <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-2 py-1">FINAL</div>
                   )}
                </div>

                {/* Global Options */}
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
                  <div className="space-y-2">
                     <button onClick={startGame} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-xl shadow hover:bg-green-700">
                        クイズ開始！
                     </button>
                  </div>
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
                        <div className="mt-1 text-xs">
                            State: <span className={`font-bold ${state.isRankingResultVisible ? 'text-green-600' : 'text-slate-500'}`}>{state.isRankingResultVisible ? 'OPEN' : 'SUSPENSE'}</span>
                        </div>
                    </div>
                    
                    {renderRankingControl()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PLAYER MANAGEMENT & SOUNDS */}
        <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* 3. Sound Board Panel */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
               <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                  <Music size={20} className="text-indigo-600"/>
                  <h2 className="font-bold text-lg text-slate-700">効果音 (Sound Board)</h2>
               </div>
               <div className="p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  {soundSlots.map((slot, index) => (
                    <div key={slot.id} className={`border rounded-lg p-2 flex flex-col gap-2 ${slot.isPlaying ? 'border-green-400 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                           <span>#{slot.id}</span>
                           <button onClick={() => toggleLoop(index)} className={`${slot.isLoop ? 'text-indigo-600' : 'text-slate-300'} hover:text-indigo-500`} title="Loop BGM">
                              <Repeat size={14}/>
                           </button>
                        </div>
                        
                        {!slot.url ? (
                           <label className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-100 transition">
                              <Upload size={20} className="text-slate-400 mb-1"/>
                              <span className="text-[10px] text-slate-500">Select File</span>
                              <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileSelect(index, e)}/>
                           </label>
                        ) : (
                           <div className="flex flex-col gap-2 h-20 justify-center">
                              <div className="text-xs truncate font-bold text-slate-700" title={slot.file?.name || 'File'}>
                                 {slot.file?.name}
                              </div>
                              <div className="flex gap-1 justify-center">
                                 <button 
                                    onClick={() => togglePlaySound(index)}
                                    className={`p-2 rounded-full text-white shadow-md transition ${slot.isPlaying ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}
                                 >
                                    {slot.isPlaying ? <RotateCcw size={16}/> : <Play size={16}/>}
                                 </button>
                                 {slot.isPlaying && (
                                    <button onClick={() => stopSound(index)} className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-md">
                                        <StopCircle size={16}/>
                                    </button>
                                 )}
                              </div>
                           </div>
                        )}
                    </div>
                  ))}
               </div>
               <div className="px-4 pb-2 text-[10px] text-slate-400 text-right">
                  ※ PC内のファイルを一時的に読み込みます。
               </div>
            </div>


            {/* 4. Player & Quiz Management */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-[400px]">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setActiveTab('PLAYERS')}
                            className={`text-sm font-bold flex items-center gap-2 pb-1 border-b-2 transition ${activeTab === 'PLAYERS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}
                        >
                            <Users size={18}/> 参加者管理 ({Array.isArray(state.players) ? state.players.length : 0}名)
                        </button>
                        <button 
                            onClick={() => setActiveTab('QUIZ')}
                            className={`text-sm font-bold flex items-center gap-2 pb-1 border-b-2 transition ${activeTab === 'QUIZ' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}
                        >
                            <Terminal size={18}/> 問題リスト (プレビュー)
                        </button>
                    </div>

                    {activeTab === 'PLAYERS' && (
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
                    )}
                </div>

                <div className="flex-1 overflow-auto p-0">
                    {activeTab === 'PLAYERS' ? (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 sticky top-0 text-xs uppercase text-slate-500 z-10">
                                <tr>
                                <th className="p-3">名前</th>
                                <th className="p-3">スコア</th>
                                <th className="p-3">合計時間</th>
                                <th className="p-3">現在の回答</th>
                                <th className="p-3 text-right">アクション</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {sortedPlayers.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-400">参加者はまだいません</td></tr>
                                ) : (
                                sortedPlayers.map((player, index) => {
                                    const hasAns = player.lastAnswerIndex !== null && player.lastAnswerIndex !== undefined;
                                    // Check correctness if needed (only during result)
                                    const isCorrect = state.gameState === GameState.PLAYING_RESULT && player.lastAnswerIndex === state.questions[state.currentQuestionIndex]?.correctIndex;
                                    const totalSec = ((player.totalResponseTime || 0) / 1000).toFixed(1);

                                    return (
                                    <tr key={player.id} className="hover:bg-slate-50 group">
                                        <td className="p-3 font-bold text-slate-800">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 text-slate-400 text-xs">{index + 1}</span>
                                            <div className={`w-2 h-2 rounded-full ${player.isOnline !== false ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                            {player.name || 'No Name'}
                                        </div>
                                        </td>
                                        <td className="p-3 font-mono font-bold text-indigo-600">{player.score || 0}</td>
                                        <td className="p-3 font-mono text-xs text-slate-500 flex items-center gap-1">
                                            <Clock size={12}/> {totalSec}s
                                        </td>
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
                    ) : (
                        // QUIZ PREVIEW TAB
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 sticky top-0 text-xs uppercase text-slate-500 z-10">
                                <tr>
                                <th className="p-3 w-10">#</th>
                                <th className="p-3">問題文</th>
                                <th className="p-3">正解</th>
                                <th className="p-3">画像</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {state.questions.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-400">問題データがありません</td></tr>
                                ) : (
                                state.questions.map((q, index) => {
                                    const hasQImage = q.questionImage;
                                    const hasOptImage = q.optionImages && q.optionImages.some(i => i);
                                    return (
                                    <tr key={index} className="hover:bg-slate-50">
                                        <td className="p-3 text-slate-400">{index + 1}</td>
                                        <td className="p-3">
                                            <div className="font-bold text-slate-700 line-clamp-2">{q.text}</div>
                                            <div className="text-xs text-slate-400 mt-1">
                                                {q.options.join(', ')}
                                            </div>
                                        </td>
                                        <td className="p-3 font-mono text-green-600">{q.options[q.correctIndex]}</td>
                                        <td className="p-3">
                                            <div className="flex flex-col gap-1">
                                                {hasQImage ? <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded inline-block w-fit">問画像あり</span> : <span className="text-[10px] text-slate-300">-</span>}
                                                {hasOptImage ? <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded inline-block w-fit">選画像あり</span> : <span className="text-[10px] text-slate-300">-</span>}
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                {activeTab === 'PLAYERS' && (
                    <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex justify-between">
                        <span>回答率: {Math.round((answeredCount / (Array.isArray(state.players) && state.players.length > 0 ? state.players.length : 1)) * 100)}%</span>
                    </div>
                )}
            </div>
        </div>

      </main>

      {/* DEBUG LOG CONSOLE (Sticky Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-black text-green-400 p-2 font-mono text-[10px] overflow-y-auto border-t-2 border-green-700 z-50 opacity-80">
          <div className="flex items-center gap-2 mb-1 sticky top-0 bg-black/90 p-1 border-b border-green-900">
              <Terminal size={12}/> System Logs
          </div>
          {debugError && <div className="text-red-500 bg-red-900/50 p-1 mb-1">{debugError}</div>}
          {logs.length === 0 && <span className="opacity-50">No logs...</span>}
          {logs.map((log, i) => (
              <div key={i}>{log}</div>
          ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
