import React, { useState } from 'react';
import { useGameCommunication } from './hooks/useGameCommunication';
import HostScreen from './components/HostScreen';
import PlayerScreen from './components/PlayerScreen';
import { Monitor, Smartphone } from 'lucide-react';

const App: React.FC = () => {
  const [role, setRole] = useState<'HOST' | 'PLAYER' | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam === 'player') return 'PLAYER';
    if (roleParam === 'host') return 'HOST';
    return null;
  });
  
  const handleBack = () => {
    setRole(null);
    // Clean URL param
    const url = new URL(window.location.href);
    url.searchParams.delete('role');
    window.history.replaceState({}, '', url);
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-slate-900 flex flex-col items-center justify-center p-6 font-sans">
        <div className="text-center mb-12">
           <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tight">
             <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">AIクイズ</span>マスター
           </h1>
           <p className="text-slate-400 text-lg max-w-md mx-auto">
             Gemini AIが生成するリアルタイムクイズバトル
           </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          <button 
            onClick={() => setRole('HOST')}
            className="group relative overflow-hidden p-8 bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-indigo-500 rounded-3xl transition-all duration-300 text-left shadow-xl"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
              <Monitor size={120} />
            </div>
            <div className="relative z-10">
              <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                <Monitor className="text-white" size={28} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">ホストとして作成</h2>
              <p className="text-slate-400">ルームを作成し、AIでクイズを生成します。大画面での表示用です。</p>
            </div>
          </button>

          <button 
            onClick={() => setRole('PLAYER')}
            className="group relative overflow-hidden p-8 bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-pink-500 rounded-3xl transition-all duration-300 text-left shadow-xl"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
              <Smartphone size={120} />
            </div>
            <div className="relative z-10">
              <div className="w-14 h-14 bg-pink-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                <Smartphone className="text-white" size={28} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">プレイヤーとして参加</h2>
              <p className="text-slate-400">スマートフォンをコントローラーにしてクイズに参加します。</p>
            </div>
          </button>
        </div>

        <div className="mt-12 text-slate-500 text-sm">
          <p>ヒント: ブラウザの別タブやウィンドウで開いて、ホストとプレイヤー両方を試すことができます。</p>
        </div>
      </div>
    );
  }

  return role === 'HOST' ? <HostApp onBack={handleBack} /> : <PlayerApp onBack={handleBack} />;
};

// Wrapper components
const HostApp: React.FC<{onBack: () => void}> = ({ onBack }) => {
  const { hostState, updateHostState } = useGameCommunication('HOST');
  return <HostScreen state={hostState} updateState={updateHostState} onBack={onBack} />;
};

const PlayerApp: React.FC<{onBack: () => void}> = ({ onBack }) => {
  const { hostState, playerId, joinGame, submitAnswer } = useGameCommunication('PLAYER');
  return (
    <PlayerScreen 
      state={hostState} 
      playerId={playerId} 
      onJoin={joinGame} 
      onAnswer={submitAnswer} 
      onBack={onBack}
    />
  );
};

export default App;
