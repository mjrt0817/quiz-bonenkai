import React, { useState, useEffect } from 'react';
import { useGameCommunication } from './hooks/useGameCommunication';
import HostScreen from './components/HostScreen';
import PlayerScreen from './components/PlayerScreen';
import AdminDashboard from './components/AdminDashboard';
import { Monitor, Smartphone, Settings } from 'lucide-react';

const App: React.FC = () => {
  // URLパスから役割を判定する関数
  const getRoleFromPath = (): 'HOST' | 'PLAYER' | 'ADMIN' | null => {
    const path = window.location.pathname;
    if (path === '/player' || path.startsWith('/player')) return 'PLAYER';
    if (path === '/host' || path.startsWith('/host')) return 'HOST';
    if (path === '/admin' || path.startsWith('/admin')) return 'ADMIN';
    return null;
  };

  const [role, setRole] = useState(getRoleFromPath);
  
  // ブラウザの戻る/進むボタンに対応
  useEffect(() => {
    const handlePopState = () => {
      setRole(getRoleFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (newRole: 'HOST' | 'PLAYER' | 'ADMIN' | null) => {
    let path = '/';
    if (newRole === 'HOST') path = '/host';
    if (newRole === 'PLAYER') path = '/player';
    if (newRole === 'ADMIN') path = '/admin';
    
    window.history.pushState({}, '', path);
    setRole(newRole);
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
            onClick={() => navigate('HOST')}
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
            onClick={() => navigate('ADMIN')}
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
            onClick={() => navigate('PLAYER')}
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
      {role === 'HOST' && <HostApp onBack={() => navigate(null)} />}
      {role === 'ADMIN' && <AdminApp onBack={() => navigate(null)} />}
      {role === 'PLAYER' && <PlayerApp onBack={() => navigate(null)} />}
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
  const { 
    hostState, updateHostState, resetPlayerAnswers, 
    resetPlayerScores, calculateAndSaveScores, 
    kickPlayer, resetAllPlayers 
  } = useGameCommunication('ADMIN');
  
  return (
    <AdminDashboard 
      state={hostState} 
      updateState={updateHostState} 
      resetPlayerAnswers={resetPlayerAnswers}
      resetPlayerScores={resetPlayerScores}
      calculateAndSaveScores={calculateAndSaveScores}
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
