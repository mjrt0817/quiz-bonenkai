import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GameState, HostState, Player } from '../types';
import { parseCSVQuiz, convertToDirectLink } from '../services/csvService';
import { 
  Loader2, Users, Trash2, Play, RotateCcw, ChevronRight, Eye, StopCircle, 
  RefreshCw, Medal, Trophy, EyeOff, Type, Clock, Lock, Unlock, Music, 
  Upload, Volume2, Pause, Repeat, Image as ImageIcon, X, QrCode, 
  Terminal, Monitor, Link, Timer, Crown, FastForward, HelpCircle, 
  CheckCircle2, AlertCircle, BookOpen, Smartphone, FileSpreadsheet, ExternalLink
} from 'lucide-react';

interface AdminDashboardProps {
  state: HostState;
  updateState: (updater: (prev: HostState) => HostState) => void;
  resetPlayerAnswers: () => Promise<void>;
  resetPlayerScores: () => Promise<void>;
  calculateAndSaveScores: () => Promise<void>;
  kickPlayer: (id: string) => Promise<void>;
  resetAllPlayers: () => Promise<void>;
  toggleOrganizer: (id: string, current: boolean) => Promise<void>;
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
  state, updateState, resetPlayerAnswers, resetPlayerScores, calculateAndSaveScores, kickPlayer, resetAllPlayers, toggleOrganizer, onBack 
}) => {
  const [csvUrl, setCsvUrl] = useState('');
  const [titleInput, setTitleInput] = useState(state.quizTitle || 'クイズ大会');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [customTimeLimit, setCustomTimeLimit] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'PLAYERS' | 'QUIZ'>('PLAYERS');
  const [isManualOpen, setIsManualOpen] = useState(false);

  const addLog = (msg: string) => {
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  // --- Sound Slots for Manual Play (1-6) ---
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
  
  // --- Auto Sounds ---
  const [introSound, setIntroSound] = useState<{file: File|null, url: string|null}>({ file: null, url: null });
  const [mainThinkingSound, setMainThinkingSound] = useState<{file: File|null, url: string|null}>({ file: null, url: null });
  const [thinkingSound, setThinkingSound] = useState<{file: File|null, url: string|null}>({ file: null, url: null });
  
  const [isMainThinkingLoop, setIsMainThinkingLoop] = useState(true);
  const [isThinkingLoop, setIsThinkingLoop] = useState(false);

  const audioRefs = useRef<(HTMLAudioElement | null)[]>(new Array(6).fill(null));
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const mainThinkingAudioRef = useRef<HTMLAudioElement | null>(null);
  const thinkingAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const hasTriggeredCountdownRef = useRef(false);

  useEffect(() => {
    return () => {
      soundSlots.forEach(slot => {
        if (slot.url) URL.revokeObjectURL(slot.url);
      });
      if (introSound.url) URL.revokeObjectURL(introSound.url);
      if (mainThinkingSound.url) URL.revokeObjectURL(mainThinkingSound.url);
      if (thinkingSound.url) URL.revokeObjectURL(thinkingSound.url);

      audioRefs.current.forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
      if (introAudioRef.current) {
          introAudioRef.current.pause();
          introAudioRef.current.src = '';
      }
      if (mainThinkingAudioRef.current) {
          mainThinkingAudioRef.current.pause();
          mainThinkingAudioRef.current.src = '';
      }
      if (thinkingAudioRef.current) {
          thinkingAudioRef.current.pause();
          thinkingAudioRef.current.src = '';
      }
    };
  }, []);

  useEffect(() => {
    if(state.quizTitle) setTitleInput(state.quizTitle);
  }, [state.quizTitle]);

  const sortedPlayers = useMemo(() => {
    try {
        const players = Array.isArray(state.players) ? state.players : [];
        const validPlayers = players.filter(p => p && typeof p === 'object' && p.id);
        
        return [...validPlayers].sort((a, b) => {
            if (a.isOrganizer && !b.isOrganizer) return 1;
            if (!a.isOrganizer && b.isOrganizer) return -1;
            const scoreA = typeof a.score === 'number' ? a.score : 0;
            const scoreB = typeof b.score === 'number' ? b.score : 0;
            if (scoreB !== scoreA) return scoreB - scoreA;
            const timeA = typeof a.totalResponseTime === 'number' ? a.totalResponseTime : 0;
            const timeB = typeof b.totalResponseTime === 'number' ? b.totalResponseTime : 0;
            if (timeA !== timeB) return timeA - timeB;
            return (a.name || '').localeCompare(b.name || '');
        });
    } catch (e: any) {
        console.error("Sort error", e);
        return [];
    }
  }, [state.players]);

  const handleFileSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (audioRefs.current[index]) {
        audioRefs.current[index]!.pause();
        audioRefs.current[index] = null;
      }
      const oldSlot = soundSlots[index];
      if (oldSlot.url) URL.revokeObjectURL(oldSlot.url);
      const url = URL.createObjectURL(file);
      setSoundSlots(prev => prev.map((slot, i) => i === index ? { ...slot, file, url, isPlaying: false } : slot));
      addLog(`Slot #${index + 1}: ファイルをセットしました (${file.name})`);
    }
  };

  const togglePlaySound = (index: number) => {
    const slot = soundSlots[index];
    if (!slot.url) return;
    
    let audio = audioRefs.current[index];
    if (!audio) {
        audio = new Audio(slot.url);
        audioRefs.current[index] = audio;
    }
    audio.volume = slot.volume;
    audio.loop = slot.isLoop;
    audio.onended = () => {
         if (!audio?.loop) setSoundSlots(prev => prev.map((s, i) => i === index ? { ...s, isPlaying: false } : s));
    };

    if (slot.isPlaying) {
        audio.pause();
        audio.currentTime = 0;
        setSoundSlots(prev => prev.map((s, i) => i === index ? { ...s, isPlaying: false } : s));
    } else {
        audio.currentTime = 0; 
        audio.play().then(() => {
            setSoundSlots(prev => prev.map((s, i) => i === index ? { ...s, isPlaying: true } : s));
        }).catch(e => console.error(e));
    }
  };

  const stopSound = (index: number) => {
    const audio = audioRefs.current[index];
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
         if (audioRefs.current[index]) audioRefs.current[index]!.loop = newLoop;
         return { ...s, isLoop: newLoop };
     }));
  };

  const handleIntroSoundSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (introSound.url) URL.revokeObjectURL(introSound.url);
          const url = URL.createObjectURL(file);
          setIntroSound({ file, url });
          addLog("問題表示時の効果音をセットしました");
      }
  };

  const handleMainThinkingSoundSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (mainThinkingSound.url) URL.revokeObjectURL(mainThinkingSound.url);
          const url = URL.createObjectURL(file);
          setMainThinkingSound({ file, url });
          addLog("メインBGM(〜残り6秒)をセットしました");
      }
  };

  const handleThinkingSoundSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (thinkingSound.url) URL.revokeObjectURL(thinkingSound.url);
          const url = URL.createObjectURL(file);
          setThinkingSound({ file, url });
          addLog("カウントダウンBGM(残り6秒〜)をセットしました");
      }
  };

  const toggleMainThinkingLoop = () => {
      const newLoop = !isMainThinkingLoop;
      setIsMainThinkingLoop(newLoop);
      if (mainThinkingAudioRef.current) mainThinkingAudioRef.current.loop = newLoop;
  };

  const toggleThinkingLoop = () => {
      const newLoop = !isThinkingLoop;
      setIsThinkingLoop(newLoop);
      if (thinkingAudioRef.current) thinkingAudioRef.current.loop = newLoop;
  };

  const playIntroSound = () => {
      if (introSound.url) {
          if (!introAudioRef.current) introAudioRef.current = new Audio(introSound.url);
          introAudioRef.current.src = introSound.url;
          introAudioRef.current.play().catch(e => console.error(e));
      }
  };

  const playMainThinkingSound = () => {
      if (mainThinkingSound.url) {
          if (!mainThinkingAudioRef.current) mainThinkingAudioRef.current = new Audio(mainThinkingSound.url);
          mainThinkingAudioRef.current.src = mainThinkingSound.url;
          mainThinkingAudioRef.current.loop = isMainThinkingLoop;
          mainThinkingAudioRef.current.play().catch(e => console.error(e));
      }
  };

  const playThinkingSound = () => {
      if (thinkingSound.url) {
          if (mainThinkingAudioRef.current) mainThinkingAudioRef.current.pause();
          if (!thinkingAudioRef.current) thinkingAudioRef.current = new Audio(thinkingSound.url);
          thinkingAudioRef.current.src = thinkingSound.url;
          thinkingAudioRef.current.loop = isThinkingLoop;
          thinkingAudioRef.current.play().catch(e => console.error(e));
      }
  };

  const stopThinkingSound = () => {
      if (mainThinkingAudioRef.current) { mainThinkingAudioRef.current.pause(); mainThinkingAudioRef.current.currentTime = 0; }
      if (thinkingAudioRef.current) { thinkingAudioRef.current.pause(); thinkingAudioRef.current.currentTime = 0; }
  };

  const loadQuestions = async () => {
    if (!csvUrl) return;
    setIsLoading(true);
    addLog('CSV読み込み開始...');
    try {
      const questions = await parseCSVQuiz(csvUrl);
      updateState(prev => ({
        ...prev, questions, gameState: GameState.LOBBY, currentQuestionIndex: 0,
        rankingRevealStage: 0, isRankingResultVisible: false, quizTitle: titleInput
      }));
      addLog(`成功！ ${questions.length}問をロードしました`);
    } catch (err: any) {
      addLog(`エラー: ${err.message}`);
      alert(`読み込みエラー: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startGame = () => {
    resetPlayerScores();
    hasTriggeredCountdownRef.current = false;
    updateState(prev => ({
      ...prev, currentQuestionIndex: 0, gameState: GameState.PLAYING_QUESTION,
      isTimerRunning: false, timeLimit: customTimeLimit
    }));
    playIntroSound();
    addLog("クイズ開始");
  };

  const startTimer = () => {
      hasTriggeredCountdownRef.current = false;
      updateState(prev => ({ ...prev, isTimerRunning: true, questionStartTime: Date.now() }));
      playMainThinkingSound();
      addLog("タイマースタート");
  };

  const showResults = async () => {
    stopThinkingSound();
    await calculateAndSaveScores();
    updateState(prev => ({ ...prev, gameState: GameState.PLAYING_RESULT, isTimerRunning: false }));
    addLog("正解を表示");
  };

  const nextQuestion = () => {
    resetPlayerAnswers();
    hasTriggeredCountdownRef.current = false;
    updateState(prev => {
      const nextIndex = prev.currentQuestionIndex + 1;
      if (nextIndex >= prev.questions.length) return { ...prev, gameState: GameState.FINAL_RESULT, rankingRevealStage: 0 };
      return { ...prev, currentQuestionIndex: nextIndex, gameState: GameState.PLAYING_QUESTION, isTimerRunning: false };
    });
    playIntroSound();
  };
  
  const forceFinishGame = () => {
      if (!confirm("強制終了しますか？")) return;
      stopThinkingSound();
      updateState(prev => ({ ...prev, gameState: GameState.FINAL_RESULT, rankingRevealStage: 0 }));
  };

  const goToStage = (stage: number) => updateState(prev => ({ ...prev, rankingRevealStage: stage, isRankingResultVisible: false }));
  const revealStage = () => updateState(prev => ({ ...prev, isRankingResultVisible: true }));
  const toggleHideBelowTop3 = () => updateState(prev => ({ ...prev, hideBelowTop3: !prev.hideBelowTop3 }));
  const toggleLobbyDetails = () => updateState(prev => ({ ...prev, isLobbyDetailsVisible: !prev.isLobbyDetailsVisible }));

  const resetGame = () => {
    updateState(prev => ({ ...prev, gameState: GameState.SETUP, questions: [], isTimerRunning: false }));
    stopThinkingSound();
    addLog("リセットしました");
  };

  useEffect(() => {
    let interval: any;
    if (state.gameState === GameState.PLAYING_QUESTION && state.isTimerRunning && state.questionStartTime) {
        interval = setInterval(() => {
            const remaining = state.timeLimit - (Date.now() - state.questionStartTime!) / 1000;
            if (remaining <= 6.5 && !hasTriggeredCountdownRef.current) {
                 hasTriggeredCountdownRef.current = true;
                 playThinkingSound();
            }
        }, 200);
    }
    return () => clearInterval(interval);
  }, [state.gameState, state.isTimerRunning, state.questionStartTime, state.timeLimit]);

  const currentQ = (state.questions && state.questions[state.currentQuestionIndex]) || { text: "...", options: [] };
  const isFinalQuestion = state.questions && state.currentQuestionIndex === state.questions.length - 1;
  const isGameRunning = state.gameState === GameState.PLAYING_QUESTION || state.gameState === GameState.PLAYING_RESULT;

  const renderRankingControl = () => (
    <div className="space-y-3 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
      <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2 mb-2">
        <Trophy size={16} /> ランキング発表
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => goToStage(0)} className={`py-2 text-xs rounded font-bold ${state.rankingRevealStage === 0 ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>準備</button>
        <button onClick={() => goToStage(1)} className={`py-2 text-xs rounded font-bold ${state.rankingRevealStage === 1 ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>3位</button>
        <button onClick={() => goToStage(2)} className={`py-2 text-xs rounded font-bold ${state.rankingRevealStage === 2 ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>2位</button>
        <button onClick={() => goToStage(3)} className={`py-2 text-xs rounded font-bold ${state.rankingRevealStage === 3 ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>1位</button>
      </div>
      <button onClick={revealStage} className="w-full mt-2 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-sm">
        <Eye size={18} /> 結果を表示 (プロジェクター)
      </button>
      <div className="mt-4 pt-4 border-t border-indigo-200">
        <button onClick={toggleHideBelowTop3} className="w-full py-2 text-xs flex items-center justify-center gap-2 text-indigo-700 hover:bg-indigo-100 rounded transition">
           {state.hideBelowTop3 ? <Eye size={14}/> : <EyeOff size={14}/>}
           {state.hideBelowTop3 ? '4位以下も表示する' : '4位以下を隠す'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans pb-20">
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-4">
           <h1 className="text-xl font-bold bg-red-600 px-3 py-1 rounded">ADMIN MODE</h1>
           <button 
             onClick={() => setIsManualOpen(true)}
             className="flex items-center gap-1 text-slate-400 hover:text-white transition text-sm bg-slate-800 px-3 py-1 rounded-full border border-slate-700"
           >
             <HelpCircle size={16}/> 使い方
           </button>
        </div>
        <button onClick={onBack} className="text-sm hover:underline text-slate-300">終了する</button>
      </header>

      {/* Manual Modal */}
      {isManualOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-xl">
                            <BookOpen size={24}/>
                        </div>
                        <div>
                            <h2 className="text-xl font-black">管理者用操作マニュアル</h2>
                            <p className="text-xs text-slate-400">AIクイズ大会システムの運用ガイド</p>
                        </div>
                    </div>
                    <button onClick={() => setIsManualOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition">
                        <X size={24}/>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 space-y-10">
                    <section className="space-y-4">
                        <h3 className="text-2xl font-black text-indigo-600 flex items-center gap-2 border-b pb-2">
                            <Monitor size={24}/> 1. 基本構成と役割
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <div className="font-bold text-slate-800 mb-1 flex items-center gap-2"><Monitor size={16} className="text-indigo-600"/> プロジェクター用</div>
                                <p className="text-xs text-slate-500">大型スクリーンに映す「見る専用」の画面です。操作は一切できません。</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <div className="font-bold text-slate-800 mb-1 flex items-center gap-2"><Terminal size={16} className="text-red-600"/> 管理者操作用</div>
                                <p className="text-xs text-slate-500">本画面です。クイズの進行、音響、参加者の管理をすべてここで行います。</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <div className="font-bold text-slate-800 mb-1 flex items-center gap-2"><Smartphone size={16} className="text-pink-600"/> プレイヤー用</div>
                                <p className="text-xs text-slate-500">参加者がスマホでアクセスする画面。回答ボタンのみが表示されます。</p>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-2xl font-black text-indigo-600 flex items-center gap-2 border-b pb-2">
                            <RefreshCw size={24}/> 2. クイズの準備 (CSV)
                        </h3>
                        <div className="space-y-3">
                            <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 flex flex-col md:flex-row gap-6 items-center">
                                <div className="flex-1 space-y-2">
                                    <p className="font-bold text-indigo-900 flex items-center gap-2">
                                        <FileSpreadsheet size={20}/> サンプルスプレッドシート
                                    </p>
                                    <p className="text-sm text-indigo-800/80 leading-relaxed">
                                        以下のテンプレートをコピー（ファイル {'->'} コピーを作成）して、ご自身の問題を作成してください。作成後、共有設定を「リンクを知っている全員」に変更したURLをコピーして管理画面に貼り付けます。
                                    </p>
                                </div>
                                <a 
                                    href="https://docs.google.com/spreadsheets/d/1RozpHh9965r7qz4RsjWgOSKYfQnsSNkqI0Jua1ElfTs/edit?usp=sharing 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-indigo-700 transition flex items-center gap-2 whitespace-nowrap"
                                >
                                    <ExternalLink size={18}/> テンプレートを開く
                                </a>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">スプレッドシートの列構成:</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono">
                                    <div className="bg-white p-2 rounded border">A: 問題文</div>
                                    <div className="bg-white p-2 rounded border">B-E: 選択肢1-4</div>
                                    <div className="bg-white p-2 rounded border">F-I: 選択肢画像</div>
                                    <div className="bg-white p-2 rounded border">J: 正解番号(1-4)</div>
                                    <div className="bg-white p-2 rounded border">K: 解説文</div>
                                    <div className="bg-white p-2 rounded border">L: 問題用画像</div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-2xl font-black text-indigo-600 flex items-center gap-2 border-b pb-2">
                            <Play size={24}/> 3. 本番の進行フロー
                        </h3>
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">1</div>
                                <div>
                                    <p className="font-bold">「クイズ開始」をクリック</p>
                                    <p className="text-xs text-slate-500">プロジェクターに第1問が表示され、Intro音が鳴ります。まだタイマーは動きません。</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">2</div>
                                <div>
                                    <p className="font-bold">「タイマースタート」をクリック</p>
                                    <p className="text-xs text-slate-500">プレイヤーのスマホに回答ボタンが出現し、メインBGMが流れ始めます。</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">3</div>
                                <div>
                                    <p className="font-bold">自動BGM切り替え (残り6秒)</p>
                                    <p className="text-xs text-slate-500">残り時間が6秒になると、自動的に「カウントダウンBGM」へ切り替わり緊張感を演出します。</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">4</div>
                                <div>
                                    <p className="font-bold">「正解を表示」をクリック</p>
                                    <p className="text-xs text-slate-500">回答を締め切り、BGMを停止して正解と解説を表示します。このタイミングでスコアが計算されます。</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-2xl font-black text-indigo-600 flex items-center gap-2 border-b pb-2">
                            <Music size={24}/> 4. 音響システム
                        </h3>
                        <ul className="list-disc list-inside text-sm text-slate-700 space-y-2 ml-4">
                            <li><strong>自動再生:</strong> 「問題表示時」「タイマー中」「カウントダウン」の3種は設定しておくと自動で流れます。</li>
                            <li><strong>手動ポン出し:</strong> Slot #1〜#6には、拍手やドラムロールなどの効果音ファイルをセットして、好きなタイミングで再生できます。</li>
                            <li><strong>Loop設定:</strong> ループをONにすると、ファイルが終わっても自動的に頭出し再生されます。メインBGMに推奨です。</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-2xl font-black text-indigo-600 flex items-center gap-2 border-b pb-2">
                            <Users size={24}/> 5. 参加者・ランキング管理
                        </h3>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                            <div className="flex items-start gap-3">
                                <Crown className="text-yellow-500 shrink-0" size={20}/>
                                <div>
                                    <p className="font-bold text-sm">主催者(Organizer)モード</p>
                                    <p className="text-xs text-slate-500">参加者リストの王冠アイコンをONにすると、その人は「主催者枠」となり、スコアが高くてもランキング上は必ず最下位に固定されます。</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Trash2 className="text-red-500 shrink-0" size={20}/>
                                <div>
                                    <p className="font-bold text-sm">キック機能</p>
                                    <p className="text-xs text-slate-500">不適切な名前のユーザーや、切断された重複ユーザーを強制退出させることができます。</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <EyeOff className="text-slate-500 shrink-0" size={20}/>
                                <div>
                                    <p className="font-bold text-sm">4位以下の非表示設定</p>
                                    <p className="text-xs text-slate-500">最終結果発表で「4位以下を隠す」をONにすると、プロジェクターには上位3名のみが表示され、表彰式の盛り上げに役立ちます。</p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="p-6 bg-slate-50 border-t flex justify-center shrink-0">
                    <button 
                        onClick={() => setIsManualOpen(false)}
                        className="bg-indigo-600 text-white px-10 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition flex items-center gap-2"
                    >
                        <CheckCircle2 size={20}/> 内容を理解しました
                    </button>
                </div>
            </div>
        </div>
      )}

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
             <p className="text-xs text-slate-500 mb-2">プレイヤー参加用URL</p>
             <div className="bg-slate-100 p-2 rounded text-xs font-mono truncate select-all">
               {typeof window !== 'undefined' ? `${window.location.origin}/player` : ''}
             </div>
          </div>

          {(state.gameState === GameState.SETUP || state.gameState === GameState.LOBBY) && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
               <h2 className="font-bold text-lg mb-3 text-slate-700 flex items-center gap-2"><Monitor size={20}/> 画面表示</h2>
               <button onClick={toggleLobbyDetails} className={`w-full py-3 rounded-lg font-bold text-sm border flex items-center justify-center gap-2 transition ${state.isLobbyDetailsVisible ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}>
                   {state.isLobbyDetailsVisible ? <ImageIcon size={18}/> : <QrCode size={18}/>}
                   {state.isLobbyDetailsVisible ? 'タイトル画像モードへ' : 'QR・参加者モードへ'}
               </button>
            </div>
          )}

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-700"><RefreshCw size={20}/> クイズ読み込み</h2>
            {state.questions.length === 0 ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">大会タイトル</label>
                  <input type="text" value={titleInput} onChange={(e) => setTitleInput(e.target.value)} placeholder="大会タイトル" className="w-full px-3 py-2 border rounded text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">CSV URL</label>
                  <input type="text" value={csvUrl} onChange={(e) => setCsvUrl(e.target.value)} placeholder="スプレッドシートURL" className="w-full px-3 py-2 border rounded text-sm" />
                </div>
                <button onClick={loadQuestions} disabled={isLoading || !csvUrl} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-bold text-sm">
                  {isLoading ? <Loader2 className="animate-spin mx-auto"/> : 'ロード'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-bold text-green-600">✅ {state.questions.length}問 ロード済み</p>
                <button onClick={resetGame} className="w-full border border-slate-300 py-2 rounded text-xs hover:bg-slate-50 text-slate-600">リセット</button>
              </div>
            )}
          </div>

          {state.questions.length > 0 && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-indigo-500">
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-700"><Play size={20}/> 進行コントロール</h2>
              <div className="space-y-4">
                <div className="text-center p-4 bg-slate-50 rounded mb-4">
                   <div className="text-xs text-slate-500 uppercase">第 {state.currentQuestionIndex + 1} 問</div>
                   <div className="text-sm font-bold truncate">{currentQ.text}</div>
                </div>

                {state.gameState === GameState.LOBBY && (
                  <button onClick={startGame} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-xl shadow hover:bg-green-700">クイズ開始</button>
                )}

                {state.gameState === GameState.PLAYING_QUESTION && (
                  <div className="space-y-3">
                      {!state.isTimerRunning ? (
                          <button onClick={startTimer} className="w-full bg-orange-600 text-white py-4 rounded-lg font-bold text-xl shadow hover:bg-orange-700 flex items-center justify-center gap-2 animate-pulse">
                              <Timer size={24}/> タイマースタート
                          </button>
                      ) : (
                          <div className="w-full bg-slate-100 text-slate-500 py-2 rounded-lg text-center text-sm font-bold border border-slate-200">
                              シンキングタイム中...
                          </div>
                      )}
                      <button onClick={showResults} disabled={!state.isTimerRunning} className="w-full bg-indigo-600 text-white py-4 rounded-lg font-bold text-xl shadow hover:bg-indigo-700 disabled:opacity-50">正解を表示</button>
                  </div>
                )}

                {state.gameState === GameState.PLAYING_RESULT && (
                  <button onClick={nextQuestion} className="w-full bg-slate-800 text-white py-4 rounded-lg font-bold text-xl shadow hover:bg-slate-900 flex justify-center items-center gap-2">
                     {isFinalQuestion ? '最終結果へ' : '次の問題へ'} <ChevronRight/>
                  </button>
                )}

                {state.gameState === GameState.FINAL_RESULT && renderRankingControl()}
                {isGameRunning && <button onClick={forceFinishGame} className="w-full bg-slate-100 text-red-600 hover:bg-red-50 py-2 rounded text-xs font-bold">強制終了</button>}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
               <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                  <Music size={20} className="text-indigo-600"/>
                  <h2 className="font-bold text-lg text-slate-700">効果音 / BGM</h2>
               </div>
               <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500">問題表示時SE</label>
                            <input type="file" accept="audio/*" onChange={handleIntroSoundSelect} className="text-xs block w-full border rounded p-1 bg-white" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-500">メインBGM (〜残り6秒)</label>
                                <button onClick={toggleMainThinkingLoop} className={`px-2 py-0.5 rounded text-[10px] ${isMainThinkingLoop ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>Loop: {isMainThinkingLoop ? 'ON' : 'OFF'}</button>
                            </div>
                            <input type="file" accept="audio/*" onChange={handleMainThinkingSoundSelect} className="text-xs block w-full border rounded p-1 bg-white" />
                        </div>
                   </div>
                   <div className="space-y-2 border-t pt-2">
                       <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-500">カウントダウンBGM (残り6秒〜)</label>
                            <button onClick={toggleThinkingLoop} className={`px-2 py-0.5 rounded text-[10px] ${isThinkingLoop ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>Loop: {isThinkingLoop ? 'ON' : 'OFF'}</button>
                       </div>
                       <input type="file" accept="audio/*" onChange={handleThinkingSoundSelect} className="text-xs block w-full border rounded p-1 bg-white" />
                   </div>
               </div>
               <div className="p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
                  {soundSlots.map((slot, index) => (
                    <div key={slot.id} className={`border rounded-lg p-2 flex flex-col gap-2 ${slot.isPlaying ? 'border-green-400 bg-green-50' : 'bg-slate-50'}`}>
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                           <span>Slot #{slot.id}</span>
                           <button onClick={() => toggleLoop(index)} className={slot.isLoop ? 'text-indigo-600' : 'text-slate-300'}><Repeat size={12}/></button>
                        </div>
                        {!slot.url ? (
                           <label className="flex flex-col items-center justify-center h-12 border border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-100">
                              <Upload size={14} className="text-slate-400"/>
                              <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileSelect(index, e)}/>
                           </label>
                        ) : (
                           <div className="flex gap-1 justify-center">
                              <button onClick={() => togglePlaySound(index)} className={`p-2 rounded-full text-white ${slot.isPlaying ? 'bg-orange-500' : 'bg-green-600'}`}>{slot.isPlaying ? <RotateCcw size={12}/> : <Play size={12}/>}</button>
                              {slot.isPlaying && <button onClick={() => stopSound(index)} className="p-2 bg-red-600 text-white rounded-full"><StopCircle size={12}/></button>}
                           </div>
                        )}
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-[400px]">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex gap-4">
                        <button onClick={() => setActiveTab('PLAYERS')} className={`text-sm font-bold pb-1 border-b-2 ${activeTab === 'PLAYERS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>参加者 ({state.players.length})</button>
                        <button onClick={() => setActiveTab('QUIZ')} className={`text-sm font-bold pb-1 border-b-2 ${activeTab === 'QUIZ' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>問題リスト</button>
                    </div>
                    {activeTab === 'PLAYERS' && (
                        <div className="flex gap-2">
                            <button onClick={resetPlayerScores} className="px-2 py-1 text-[10px] border rounded hover:bg-slate-100">スコアリセット</button>
                            <button onClick={() => confirm('全員キックしますか？') && resetAllPlayers()} className="px-2 py-1 text-[10px] bg-red-100 text-red-600 rounded">全員キック</button>
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-auto p-0">
                    {activeTab === 'PLAYERS' ? (
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 sticky top-0 text-slate-500">
                                <tr><th className="p-2">名前</th><th className="p-2">スコア</th><th className="p-2 text-right">操作</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedPlayers.map((player, index) => (
                                    <tr key={player.id} className="hover:bg-slate-50 group">
                                        <td className="p-2 flex items-center gap-2">
                                            <span className="text-slate-300 w-4">{index + 1}</span>
                                            {player.name} {player.isOrganizer && <Crown size={12} className="text-yellow-500" />}
                                        </td>
                                        <td className="p-2 font-bold">{player.score || 0}</td>
                                        <td className="p-2 text-right space-x-2">
                                            <button onClick={() => toggleOrganizer(player.id, !!player.isOrganizer)} className={player.isOrganizer ? 'text-yellow-500' : 'text-slate-300 hover:text-yellow-500'}><Crown size={14}/></button>
                                            <button onClick={() => confirm(`${player.name}をキックしますか？`) && kickPlayer(player.id)} className="text-slate-300 hover:text-red-600"><Trash2 size={14}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-4 space-y-2">
                            {state.questions.map((q, i) => (
                                <div key={i} className="text-xs border-b pb-1">
                                    <span className="text-slate-400 mr-2">{i+1}.</span>
                                    <span className="font-bold">{q.text}</span>
                                    <span className="text-green-600 ml-2">({q.options[q.correctIndex]})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 h-24 bg-black text-green-400 p-2 font-mono text-[10px] overflow-y-auto border-t-2 border-green-700 z-50 opacity-80">
          {logs.map((log, i) => <div key={i}>{log}</div>)}
      </div>
    </div>
  );
};

export default AdminDashboard;
