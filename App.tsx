import React, { useState } from 'react';
import { useGameCommunication } from './hooks/useGameCommunication';
import HostScreen from './components/HostScreen';
import PlayerScreen from './components/PlayerScreen';
import AdminDashboard from './components/AdminDashboard';
import { Monitor, Smartphone, Settings } from 'lucide-react';

const App: React.FC = () => {
  const [role, setRole] = useState<'HOST' | 'PLAYER' | 'ADMIN' | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam === 'player') return 'PLAYER';
    if (roleParam === 'host') return 'HOST';
    if (roleParam === 'admin') return 'ADMIN';
    return null;
  });
  
  const handleBack = () => {
    setRole(null);
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
             CSVロードにも対応した本格的クイズ大会システム
           </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
          <button 
            onClick={() => setRole('HOST')}
            className="group relative overflow-hidden p-6 bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-indigo-500 rounded-3xl transition-all duration-300 text-left shadow-xl"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
              <Monitor size={100} />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <Monitor className="text-white" size={24} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">プロジェクター表示</h2>
              <p className="text-slate-400 text-sm">会場のスクリーンに映すためのビューアーです。操作はできません。</p>
            </div>
          </button>

          <button 
            onClick={() => setRole('ADMIN')}
            className="group relative overflow-hidden p-6 bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-blue-500 rounded-3xl transition-all duration-300 text-left shadow-xl"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
              <Settings size={100} />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <Settings className="text-white" size={24} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">管理・操作画面</h2>
              <p className="text-slate-400 text-sm">クイズの進行、CSV読み込み、参加者管理を行うホスト用の画面です。</p>
            </div>
          </button>

          <button 
            onClick={() => setRole('PLAYER')}
            className="group relative overflow-hidden p-6 bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-pink-500 rounded-3xl transition-all duration-300 text-left shadow-xl"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
              <Smartphone size={100} />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-pink-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <Smartphone className="text-white" size={24} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">プレイヤー参加</h2>
              <p className="text-slate-400 text-sm">スマホで参加します。QRコードからアクセスしてください。</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {role === 'HOST' && <HostApp onBack={handleBack} />}
      {role === 'ADMIN' && <AdminApp onBack={handleBack} />}
      {role === 'PLAYER' && <PlayerApp onBack={handleBack} />}
    </>
  );
};

// Wrapper components
const HostApp: React.FC<{onBack: () => void}> = ({ onBack }) => {
  const { hostState } = useGameCommunication('HOST');
  return (
    <HostScreen 
      state={hostState} 
      onBack={onBack} 
    />
  );
};

const AdminApp: React.FC<{onBack: () => void}> = ({ onBack }) => {
  const { hostState, updateHostState, resetPlayerAnswers, resetPlayerScores, kickPlayer, resetAllPlayers } = useGameCommunication('ADMIN');
  return (
    <AdminDashboard 
      state={hostState} 
      updateState={updateHostState} 
      resetPlayerAnswers={resetPlayerAnswers}
      resetPlayerScores={resetPlayerScores}
      kickPlayer={kickPlayer}
      resetAllPlayers={resetAllPlayers}
      onBack={onBack}
    />
  );
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
