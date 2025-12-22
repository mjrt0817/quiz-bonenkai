import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GameState, HostState, Player } from '../types';
import { parseCSVQuiz, convertToDirectLink } from '../services/csvService';
import { 
  Loader2, Users, Trash2, Play, RotateCcw, ChevronRight, Eye, StopCircle, 
  RefreshCw, Medal, Trophy, EyeOff, Type, Clock, Lock, Unlock, Music, 
  Upload, Volume2, Pause, Repeat, Image as ImageIcon, X, QrCode, 
  Terminal, Monitor, Link, Timer, Crown, FastForward, HelpCircle, 
  CheckCircle2, AlertCircle, BookOpen, Smartphone, FileSpreadsheet, ExternalLink,
  Info, Zap, ShieldAlert, ListChecks, Users2, Megaphone, Mic2, MessageSquare
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
  const [customTimeLimit, setCustomTimeLimit] = useState(state.timeLimit || 20);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'PLAYERS' | 'QUIZ'>('PLAYERS');
  const [isManualOpen, setIsManualOpen] = useState(false);

  const addLog = (msg: string) => {
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  const [soundSlots, setSoundSlots] = useState<SoundSlot[]>(
    Array.from({ length: 6 }, (_, i) => ({
      id: i + 1, file: null, url: null, isPlaying: false, isLoop: false, volume: 1.0,
    }))
  );
  
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
      soundSlots.forEach(slot => { if (slot.url) URL.revokeObjectURL(slot.url); });
      if (introSound.url) URL.revokeObjectURL(introSound.url);
      if (mainThinkingSound.url) URL.revokeObjectURL(mainThinkingSound.url);
      if (thinkingSound.url) URL.revokeObjectURL(thinkingSound.url);
      audioRefs.current.forEach(audio => { if (audio) { audio.pause(); audio.src = ''; } });
      if (introAudioRef.current) { introAudioRef.current.pause(); introAudioRef.current.src = ''; }
      if (mainThinkingAudioRef.current) { mainThinkingAudioRef.current.pause(); mainThinkingAudioRef.current.src = ''; }
      if (thinkingAudioRef.current) { thinkingAudioRef.current.pause(); thinkingAudioRef.current.src = ''; }
    };
  }, []);

  useEffect(() => { if(state.quizTitle) setTitleInput(state.quizTitle); }, [state.quizTitle]);

  const sortedPlayers = useMemo(() => {
    try {
        const players = Array.isArray(state.players) ? state.players : [];
        const validPlayers = players.filter(p => p?.id);
        
        return [...validPlayers].sort((a, b) => {
            if (a.isOrganizer && !b.isOrganizer) return 1;
            if (!a.isOrganizer && b.isOrganizer) return -1;
            const scoreA = a.score || 0;
            const scoreB = b.score || 0;
            if (scoreB !== scoreA) return scoreB - scoreA;
            const timeA = a.totalResponseTime || 0;
            const timeB = b.totalResponseTime || 0;
            if (timeA !== timeB) return timeA - timeB;
            return (a.name || '').localeCompare(b.name || '');
        });
    } catch (e: any) {
        return [];
    }
  }, [state.players]);

  const handleFileSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (audioRefs.current[index]) { audioRefs.current[index]!.pause(); audioRefs.current[index] = null; }
      if (soundSlots[index].url) URL.revokeObjectURL(soundSlots[index].url!);
      const url = URL.createObjectURL(file);
      setSoundSlots(prev => prev.map((slot, i) => i === index ? { ...slot, file, url, isPlaying: false } : slot));
      addLog(`Slot #${index + 1}: ${file.name} をセット`);
    }
  };

  const togglePlaySound = (index: number) => {
    const slot = soundSlots[index];
    if (!slot.url) return;
    let audio = audioRefs.current[index];
    if (!audio) { audio = new Audio(slot.url); audioRefs.current[index] = audio; }
    audio.volume = slot.volume;
    audio.loop = slot.isLoop;
    audio.onended = () => { if (!audio?.loop) setSoundSlots(prev => prev.map((s, i) => i === index ? { ...s, isPlaying: false } : s)); };
    if (slot.isPlaying) {
        audio.pause(); audio.currentTime = 0;
        setSoundSlots(prev => prev.map((s, i) => i === index ? { ...s, isPlaying: false } : s));
    } else {
        audio.currentTime = 0; 
        audio.play().then(() => { setSoundSlots(prev => prev.map((s, i) => i === index ? { ...s, isPlaying: true } : s)); }).catch(e => console.error(e));
    }
  };

  const stopSound = (index: number) => {
    if (audioRefs.current[index]) { audioRefs.current[index]!.pause(); audioRefs.current[index]!.currentTime = 0; }
    setSoundSlots(prev => prev.map((s, i) => i === index ? { ...s, isPlaying: false } : s));
  };

  const toggleLoop = (index: number) => {
     setSoundSlots(prev => prev.map((s, i) => {
         if (i !== index) return s;
         if (audioRefs.current[index]) audioRefs.current[index]!.loop = !s.isLoop;
         return { ...s, isLoop: !s.isLoop };
     }));
  };

  const handleIntroSoundSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (introSound.url) URL.revokeObjectURL(introSound.url);
          setIntroSound({ file, url: URL.createObjectURL(file) });
          addLog("問題表示時SEをセット");
      }
  };

  const handleMainThinkingSoundSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (mainThinkingSound.url) URL.revokeObjectURL(mainThinkingSound.url);
          setMainThinkingSound({ file, url: URL.createObjectURL(file) });
          addLog("メインBGMをセット");
      }
  };

  const handleThinkingSoundSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (thinkingSound.url) URL.revokeObjectURL(thinkingSound.url);
          setThinkingSound({ file, url: URL.createObjectURL(file) });
          addLog("カウントダウンBGMをセット");
      }
  };

  const toggleMainThinkingLoop = () => {
      setIsMainThinkingLoop(!isMainThinkingLoop);
      if (mainThinkingAudioRef.current) mainThinkingAudioRef.current.loop = !isMainThinkingLoop;
  };

  const toggleThinkingLoop = () => {
      setIsThinkingLoop(!isThinkingLoop);
      if (thinkingAudioRef.current) thinkingAudioRef.current.loop = !isThinkingLoop;
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
      addLog(`成功！ ${questions.length}問をロード`);
    } catch (err: any) {
      addLog(`エラー: ${err.message}`);
      alert(`読み込みエラー: ${err.message}`);
    } finally { setIsLoading(false); }
  };

  const startGame = () => {
    resetPlayerScores();
    hasTriggeredCountdownRef.current = false;
    updateState(prev => ({ ...prev, currentQuestionIndex: 0, gameState: GameState.PLAYING_QUESTION, isTimerRunning: false, timeLimit: customTimeLimit }));
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
      return { ...prev, currentQuestionIndex: nextIndex, gameState: GameState.PLAYING_QUESTION, isTimerRunning: false, timeLimit: customTimeLimit };
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
  const toggleRules = () => updateState(prev => ({ ...prev, isRulesVisible: !prev.isRulesVisible }));

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
      <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2 mb-2"><Trophy size={16} /> ランキング発表</h3>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => goToStage(0)} className={`py-2 text-xs rounded font-bold ${state.rankingRevealStage === 0 ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>準備</button>
        <button onClick={() => goToStage(1)} className={`py-2 text-xs rounded font-bold ${state.rankingRevealStage === 1 ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>3位</button>
        <button onClick={() => goToStage(2)} className={`py-2 text-xs rounded font-bold ${state.rankingRevealStage === 2 ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>2位</button>
        <button onClick={() => goToStage(3)} className={`py-2 text-xs rounded font-bold ${state.rankingRevealStage === 3 ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>1位</button>
      </div>
      <button onClick={revealStage} className="w-full mt-2 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-sm"><Eye size={18} /> 結果を表示</button>
      <div className="mt-4 pt-4 border-t border-indigo-200">
        <button onClick={toggleHideBelowTop3} className="w-full py-2 text-xs flex items-center justify-center gap-2 text-indigo-700 hover:bg-indigo-100 rounded transition">
           {state.hideBelowTop3 ? <Eye size={14}/> : <EyeOff size={14}/>} {state.hideBelowTop3 ? '4位以下も表示する' : '4位以下を隠す'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans pb-20">
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-4">
           <h1 className="text-xl font-bold bg-red-600 px-3 py-1 rounded">ADMIN MODE</h1>
           <button onClick={() => setIsManualOpen(true)} className="flex items-center gap-1 text-slate-400 hover:text-white transition text-sm bg-slate-800 px-3 py-1 rounded-full border border-slate-700"><HelpCircle size={16}/> 使い方</button>
        </div>
        <button onClick={onBack} className="text-sm hover:underline text-slate-300">終了する</button>
      </header>

      {isManualOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-xl"><BookOpen size={24}/></div>
                        <div>
                            <h2 className="text-xl font-black">AIクイズ大会 完全操作ガイド</h2>
                            <p className="text-xs text-slate-400">当日の運営フローと役割・注意事項</p>
                        </div>
                    </div>
                    <button onClick={() => setIsManualOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition"><X size={24}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 space-y-12">
                    {/* ロール別の役割 */}
                    <section className="space-y-6">
                        <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2 border-b-4 border-indigo-600 pb-2">
                            <Users2 size={24} className="text-indigo-600"/> 各ロールの表示と役割
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-indigo-50 p-5 rounded-2xl border-2 border-indigo-200">
                                <div className="font-bold text-indigo-900 mb-3 flex items-center gap-2"><Monitor size={20}/> プロジェクター (HOST)</div>
                                <ul className="text-xs text-indigo-800 space-y-2 list-disc list-inside">
                                    <li>会場全員が見る画面。PCを大型モニタ等に接続。</li>
                                    <li>操作は不要（Admin画面の操作が自動反映）。</li>
                                    <li>LobbyではQRコードと参加者リストを表示。</li>
                                    <li>本番中は「問題」「制限時間」「正解」「ランキング」を表示。</li>
                                </ul>
                            </div>
                            <div className="bg-red-50 p-5 rounded-2xl border-2 border-red-200">
                                <div className="font-bold text-red-900 mb-3 flex items-center gap-2"><Terminal size={20}/> 管理者 (ADMIN)</div>
                                <ul className="text-xs text-red-800 space-y-2 list-disc list-inside">
                                    <li><strong>本画面。</strong> 進行担当者が操作するタブレットやPC。</li>
                                    <li>CSVの読み込み、BGMの設定、問題の切り替え。</li>
                                    <li>参加者のキック、主催者フラグの切り替え。</li>
                                    <li>タイマーの開始・正解表示などの全トリガー。</li>
                                </ul>
                            </div>
                            <div className="bg-pink-50 p-5 rounded-2xl border-2 border-pink-200">
                                <div className="font-bold text-pink-900 mb-3 flex items-center gap-2"><Smartphone size={20}/> 参加者 (PLAYER)</div>
                                <ul className="text-xs text-pink-800 space-y-2 list-disc list-inside">
                                    <li>参加者の個人のスマホ。QRコードからブラウザでアクセス。</li>
                                    <li>タイマー開始までボタンは無効化されます。</li>
                                    <li>解答ボタン、正解/不正解、個人の暫定順位を表示。</li>
                                    <li>最終結果発表は「Adminが1位まで表示」するまで隠されます。</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* 参加者へのアナウンス事項 */}
                    <section className="space-y-6">
                        <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2 border-b-4 border-pink-500 pb-2">
                            <Megaphone size={24} className="text-pink-500"/> 参加者への説明・アナウンス事項
                        </h3>
                        <div className="bg-pink-50 rounded-3xl p-6 border border-pink-100 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <h4 className="font-black text-pink-900 flex items-center gap-2"><CheckCircle2 size={18} className="text-pink-600"/> 参加時の案内</h4>
                                    <ul className="text-xs text-pink-800 space-y-2 list-inside list-disc">
                                        <li>「スクリーン上のQRコードを読み取ってください」</li>
                                        <li>「好きなニックネームを入力して、開始までお待ちください」</li>
                                        <li>「一度参加した後は、ブラウザの『戻る』や『更新』は押さないでください」</li>
                                        <li>「万が一画面が真っ白になったら、再度読み込んで同じ名前で入り直してください」</li>
                                    </ul>
                                </div>
                                <div className="space-y-3">
                                    <h4 className="font-black text-pink-900 flex items-center gap-2"><CheckCircle2 size={18} className="text-pink-600"/> 回答ルールの案内</h4>
                                    <ul className="text-xs text-pink-800 space-y-2 list-inside list-disc">
                                        <li>「問題が表示された後、管理者が合図（タイマースタート）するまでボタンは出ません」</li>
                                        <li>「正解すると10ポイント加算されます」</li>
                                        <li>「同点の場合は、**回答が早かった人**が上位になります。スピード重視です！」</li>
                                        <li>「一度回答ボタンを押すと、その問題の回答は変更できません」</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="p-4 bg-white rounded-2xl border border-pink-200 shadow-sm">
                                <p className="text-xs font-bold text-pink-900 mb-2 italic">司会者用カンペ例：</p>
                                <p className="text-sm text-pink-700 leading-relaxed font-medium">
                                    「皆さん、準備はいいですか？ 同点の場合は回答速度が順位を左右します！ 問題をよく読んで、これだ！と思ったら迷わずボタンを押してくださいね。それでは、第1問、スタート！」
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 詳細フロー */}
                    <section className="space-y-6">
                        <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2 border-b-4 border-indigo-600 pb-2">
                            <ListChecks size={24} className="text-indigo-600"/> 運営ステップ・バイ・ステップ
                        </h3>
                        <div className="space-y-4">
                            {[
                                { step: "1. 準備", desc: "CSV URLを入力し「ロード」をクリック。タイトルや制限時間を設定。効果音ファイルを各スロットにセット。", color: "bg-slate-100" },
                                { step: "2. ロビー", desc: "プロジェクターにQRを表示して参加を募る。Admin画面で参加者名に不備がないか確認（適宜キック）。", color: "bg-indigo-50" },
                                { step: "3. クイズ開始", desc: "「クイズ開始」をクリック。プロジェクターに第1問が表示され、Intro音が鳴る。まだ回答はできない。", color: "bg-blue-50" },
                                { step: "4. 回答開始", desc: "「タイマースタート」をクリック。全員のスマホにボタンが出現し、BGMが流れる。この時点からの秒数が計測される。", color: "bg-orange-50" },
                                { step: "5. 正解表示", desc: "時間が切れる前、または全員が回答したら「正解を表示」をクリック。BGM停止、正解と解説が表示される。", color: "bg-green-50" },
                                { step: "6. 次の問題へ", desc: "「次の問題へ」をクリック。全問終わるまで3〜5を繰り返す。", color: "bg-slate-100" },
                                { step: "7. 結果発表", desc: "最終問題終了後、3位→2位→1位の順に「結果を表示」をクリックして、会場を盛り上げながら発表する。", color: "bg-yellow-50" },
                            ].map((item, i) => (
                                <div key={i} className={`p-4 rounded-xl flex gap-4 items-start ${item.color} border border-slate-200`}>
                                    <div className="bg-slate-900 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">{i+1}</div>
                                    <div>
                                        <div className="font-bold text-slate-900">{item.step}</div>
                                        <p className="text-sm text-slate-600">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 注意事項 */}
                    <section className="space-y-6">
                        <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2 border-b-4 border-red-600 pb-2">
                            <ShieldAlert size={24} className="text-red-600"/> 重要・注意事項
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl">
                                <div className="font-bold text-red-800 flex items-center gap-2 mb-1"><Zap size={16}/> 通信環境について</div>
                                <p className="text-xs text-red-700">全員がFirebaseを介してリアルタイム通信します。不安定なWi-Fi環境ではラグが生じ、回答ボタンが出ない等のトラブルの原因になります。</p>
                            </div>
                            <div className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded-r-xl">
                                <div className="font-bold text-orange-800 flex items-center gap-2 mb-1"><Crown size={16}/> 主催者参加モード</div>
                                <p className="text-xs text-orange-700">運営チームがテスト等で参加する場合、参加者リストの「王冠アイコン」をONにしてください。スコアは記録されますが、最終ランキングでは必ず最下位に回されます。</p>
                            </div>
                            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-xl">
                                <div className="font-bold text-blue-800 flex items-center gap-2 mb-1"><FileSpreadsheet size={16}/> CSVの形式</div>
                                <p className="text-xs text-blue-700">スプレッドシートは必ず「リンクを知っている全員」に公開してください。正解番号は 1〜4 で指定します。</p>
                            </div>
                            <div className="p-4 bg-purple-50 border-l-4 border-purple-500 rounded-r-xl">
                                <div className="font-bold text-purple-800 flex items-center gap-2 mb-1"><Music size={16}/> BGMのループ</div>
                                <p className="text-xs text-purple-700">メインBGMは「Loop」をONにしておくことを推奨します。カウントダウンSEは単発（Loop OFF）の方が終わりが綺麗です。</p>
                            </div>
                        </div>
                    </section>

                    {/* CSVテンプレートリンク */}
                    <div className="bg-slate-900 p-8 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
                        <div className="space-y-2">
                            <h4 className="text-xl font-bold flex items-center gap-2"><FileSpreadsheet className="text-green-400"/> スプレッドシート用テンプレート</h4>
                            <p className="text-sm text-slate-400">コピーしてご利用ください。画像URLはGoogleドライブの共有URLに対応しています。</p>
                        </div>
                        <a 
                            href="https://docs.google.com/spreadsheets/d/1RozpHh9965r7qz4RsjWgOSKYfQnsSNkqI0Jua1ElfTs/edit?usp=sharing" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-slate-100 transition flex items-center gap-2"
                        >
                            <ExternalLink size={20}/> テンプレートを開く
                        </a>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t flex justify-center shrink-0">
                    <button 
                        onClick={() => setIsManualOpen(false)}
                        className="bg-indigo-600 text-white px-12 py-4 rounded-full font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition flex items-center gap-3"
                    >
                        <CheckCircle2 size={24}/> 内容をすべて理解しました
                    </button>
                </div>
            </div>
        </div>
      )}

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側カラム：設定・進行 */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
             <p className="text-xs text-slate-500 mb-2">プレイヤー参加用URL</p>
             <div className="bg-slate-100 p-2 rounded text-xs font-mono truncate select-all">{typeof window !== 'undefined' ? `${window.location.origin}/player` : ''}</div>
          </div>

          {(state.gameState === GameState.SETUP || state.gameState === GameState.LOBBY) && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
               <h2 className="font-bold text-lg mb-3 text-slate-700 flex items-center gap-2"><Monitor size={20}/> 画面表示</h2>
               <div className="space-y-2">
                  <button onClick={toggleLobbyDetails} className={`w-full py-3 rounded-lg font-bold text-sm border flex items-center justify-center gap-2 transition ${state.isLobbyDetailsVisible ? 'bg-slate-100 text-slate-700' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                      {state.isLobbyDetailsVisible ? <ImageIcon size={18}/> : <QrCode size={18}/>} {state.isLobbyDetailsVisible ? 'タイトル画像モードへ' : 'QR・参加者モードへ'}
                  </button>
                  <button onClick={toggleRules} className={`w-full py-3 rounded-lg font-bold text-sm border flex items-center justify-center gap-2 transition ${state.isRulesVisible ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border-indigo-600'}`}>
                      <Info size={18}/> {state.isRulesVisible ? 'ルール案内を隠す' : '回答ルール案内を表示'}
                  </button>
               </div>
            </div>
          )}

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-700"><RefreshCw size={20}/> クイズ読み込み</h2>
            {state.questions.length === 0 ? (
              <div className="space-y-4">
                <div className="space-y-1"><label className="text-xs font-bold text-slate-500">大会タイトル</label><input type="text" value={titleInput} onChange={(e) => setTitleInput(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" /></div>
                <div className="space-y-1"><label className="text-xs font-bold text-slate-500">CSV URL</label><input type="text" value={csvUrl} onChange={(e) => setCsvUrl(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" /></div>
                <button onClick={loadQuestions} disabled={isLoading || !csvUrl} className="w-full bg-blue-600 text-white py-2 rounded font-bold text-sm">{isLoading ? <Loader2 className="animate-spin mx-auto"/> : 'ロード'}</button>
              </div>
            ) : (
              <div className="space-y-3"><p className="text-sm font-bold text-green-600">✅ {state.questions.length}問 ロード済み</p><button onClick={resetGame} className="w-full border border-slate-300 py-2 rounded text-xs text-slate-600">リセット</button></div>
            )}
          </div>

          {state.questions.length > 0 && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-indigo-500">
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-700"><Play size={20}/> 進行コントロール</h2>
              <div className="space-y-4">
                <div className="space-y-1 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Clock size={12}/> 制限時間 (秒)</label>
                  <div className="flex items-center gap-2"><input type="number" value={customTimeLimit} onChange={(e) => setCustomTimeLimit(Number(e.target.value))} className="w-full px-3 py-1.5 border rounded text-sm font-bold" min="1"/><span className="text-xs text-slate-400 font-bold">秒</span></div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded mb-4"><div className="text-xs text-slate-500 uppercase">第 {state.currentQuestionIndex + 1} 問</div><div className="text-sm font-bold truncate">{currentQ.text}</div></div>
                {state.gameState === GameState.LOBBY && <button onClick={startGame} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-xl shadow">クイズ開始</button>}
                {state.gameState === GameState.PLAYING_QUESTION && (
                  <div className="space-y-3">
                      {!state.isTimerRunning ? <button onClick={startTimer} className="w-full bg-orange-600 text-white py-4 rounded-lg font-bold text-xl shadow animate-pulse"><Timer size={24}/> タイマースタート</button> : <div className="w-full bg-slate-100 text-slate-500 py-2 rounded-lg text-center text-sm font-bold">シンキングタイム中...</div>}
                      <button onClick={showResults} disabled={!state.isTimerRunning} className="w-full bg-indigo-600 text-white py-4 rounded-lg font-bold text-xl shadow">正解を表示</button>
                  </div>
                )}
                {state.gameState === GameState.PLAYING_RESULT && <button onClick={nextQuestion} className="w-full bg-slate-800 text-white py-4 rounded-lg font-bold text-xl shadow flex justify-center items-center gap-2">{isFinalQuestion ? '最終結果へ' : '次の問題へ'} <ChevronRight/></button>}
                {state.gameState === GameState.FINAL_RESULT && renderRankingControl()}
                {isGameRunning && <button onClick={forceFinishGame} className="w-full bg-slate-100 text-red-600 py-2 rounded text-xs font-bold">強制終了</button>}
              </div>
            </div>
          )}
        </div>

        {/* 右側カラム：アナウンス・音響・リスト */}
        <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* 司会用アナウンス（カンペ）パネル */}
            <div className="bg-pink-50 rounded-xl shadow-sm border border-pink-200 overflow-hidden">
                <div className="p-4 bg-pink-600 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2 font-black">
                        <Mic2 size={20}/>
                        <span>司会用プロンプター (カンペ)</span>
                    </div>
                    <Megaphone size={20} className="opacity-50"/>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <div className="flex items-start gap-2">
                            <div className="bg-pink-200 text-pink-700 p-1 rounded mt-0.5"><Users2 size={14}/></div>
                            <div>
                                <p className="text-xs font-bold text-pink-800">参加案内</p>
                                <p className="text-[11px] text-pink-600 leading-tight">「スクリーン上のQRを読み込んでください。ニックネームを入れて開始まで待機してください。」</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="bg-pink-200 text-pink-700 p-1 rounded mt-0.5"><ShieldAlert size={14}/></div>
                            <div>
                                <p className="text-xs font-bold text-pink-800">接続の注意</p>
                                <p className="text-[11px] text-pink-600 leading-tight">「一度参加したら、ブラウザの『戻る』や『更新』は押さないでくださいね。」</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-start gap-2">
                            <div className="bg-pink-200 text-pink-700 p-1 rounded mt-0.5"><Zap size={14}/></div>
                            <div>
                                <p className="text-xs font-bold text-pink-800">回答ルール</p>
                                <p className="text-[11px] text-pink-600 leading-tight">「同点の場合は回答スピードが勝負です！合図のあと、迷わずボタンを押しましょう。」</p>
                            </div>
                        </div>
                        <div className="bg-white border border-pink-100 p-2 rounded-lg flex items-start gap-2">
                            <MessageSquare size={14} className="text-pink-400 mt-1 shrink-0"/>
                            <p className="text-[11px] italic font-medium text-pink-700 leading-relaxed">
                                「それでは準備はいいですか？ 第1問、スタート！」
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
               <div className="p-4 border-b border-slate-200 flex items-center gap-2"><Music size={20} className="text-indigo-600"/><h2 className="font-bold text-lg text-slate-700">効果音 / BGM</h2></div>
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
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400"><span className="truncate" title={slot.file?.name || '未設定'}>Slot #{slot.id}</span><button onClick={() => toggleLoop(index)} className={slot.isLoop ? 'text-indigo-600' : 'text-slate-300'}><Repeat size={12}/></button></div>
                        {!slot.url ? <label className="flex flex-col items-center justify-center h-12 border border-dashed border-slate-300 rounded cursor-pointer"><Upload size={14} className="text-slate-400"/><input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileSelect(index, e)}/></label> : <><div className="flex gap-1 justify-center"><button onClick={() => togglePlaySound(index)} className={`p-2 rounded-full text-white ${slot.isPlaying ? 'bg-orange-500' : 'bg-green-600'}`}>{slot.isPlaying ? <RotateCcw size={12}/> : <Play size={12}/>}</button>{slot.isPlaying && <button onClick={() => stopSound(index)} className="p-2 bg-red-600 text-white rounded-full"><StopCircle size={12}/></button>}</div><div className="text-[9px] text-slate-500 text-center truncate">{slot.file?.name}</div></>}
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
                            <button onClick={resetPlayerScores} className="px-2 py-1 text-[10px] border rounded">スコアリセット</button>
                            <button onClick={() => confirm('全員キックしますか？') && resetAllPlayers()} className="px-2 py-1 text-[10px] bg-red-100 text-red-600 rounded">全員キック</button>
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-auto">
                    {activeTab === 'PLAYERS' ? (
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 sticky top-0 text-slate-500">
                                <tr><th className="p-2">名前</th><th className="p-2">スコア</th><th className="p-2">合計タイム</th><th className="p-2 text-right">操作</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedPlayers.map((player, index) => (
                                    <tr key={player.id} className="hover:bg-slate-50">
                                        <td className="p-2 flex items-center gap-2"><span className="text-slate-300 w-4">{index + 1}</span>{player.name} {player.isOrganizer && <Crown size={12} className="text-yellow-500" />}</td>
                                        <td className="p-2 font-bold">{player.score || 0}</td>
                                        <td className="p-2 font-mono text-slate-500 text-[10px]">{( (player.totalResponseTime || 0) / 1000 ).toFixed(2)}s</td>
                                        <td className="p-2 text-right space-x-2">
                                            <button onClick={() => toggleOrganizer(player.id, !!player.isOrganizer)} className={player.isOrganizer ? 'text-yellow-500' : 'text-slate-300'}><Crown size={14}/></button>
                                            <button onClick={() => confirm(`${player.name}をキックしますか？`) && kickPlayer(player.id)} className="text-slate-300 hover:text-red-600"><Trash2 size={14}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-4 space-y-2">
                            {state.questions.map((q, i) => (
                                <div key={i} className="text-xs border-b pb-1"><span className="text-slate-400 mr-2">{i+1}.</span><span className="font-bold">{q.text}</span><span className="text-green-600 ml-2">({q.options[q.correctIndex]})</span></div>
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
