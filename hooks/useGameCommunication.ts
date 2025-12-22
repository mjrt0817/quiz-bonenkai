import { useState, useEffect, useCallback } from 'react';
import { GameState, HostState, Player } from '../types';
import { db } from '../services/firebaseConfig';

const ROOM_ID = 'party-room-2024';

const INITIAL_HOST_STATE: HostState = {
  gameState: GameState.SETUP,
  currentQuestionIndex: 0,
  questions: [],
  players: [],
  roomCode: 'EVENT',
  timeLimit: 20,
  questionStartTime: null,
  isTimerRunning: false,
  rankingRevealStage: 0,
  isRankingResultVisible: false,
  hideBelowTop3: false,
  quizTitle: 'クイズ大会',
  titleImage: null,
  isLobbyDetailsVisible: false,
  isRulesVisible: false,
};

export const useGameCommunication = (role: 'HOST' | 'PLAYER' | 'ADMIN') => {
  const [hostState, setHostState] = useState<HostState>(INITIAL_HOST_STATE);
  const [playerId, setPlayerId] = useState(() => localStorage.getItem('quiz_player_id') || '');
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    const stateRef = db.ref(`rooms/${ROOM_ID}/state`);
    const handleStateChange = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        let safePlayers: Player[] = [];
        if (Array.isArray(data.players)) {
            safePlayers = data.players.filter((p: any) => p && typeof p === 'object');
        } else if (data.players && typeof data.players === 'object') {
            safePlayers = Object.values(data.players).filter((p: any) => p && typeof p === 'object') as Player[];
        }

        setHostState({
            ...INITIAL_HOST_STATE,
            ...data,
            questions: data.questions || [],
            players: safePlayers
        });
      } else if (role === 'HOST' || role === 'ADMIN') {
        stateRef.set(INITIAL_HOST_STATE);
      }
    };
    stateRef.on('value', handleStateChange);
    
    const playersRef = db.ref(`rooms/${ROOM_ID}/players`);
    const handlePlayersChange = (snap: any) => {
      const playersObj = snap.val() || {};
      const playersList = (Object.values(playersObj) as Player[]).filter(p => p && typeof p === 'object');
      setHostState(prev => ({ ...prev, players: playersList }));
      if (role === 'HOST' || role === 'ADMIN') {
         db.ref(`rooms/${ROOM_ID}/state/players`).set(playersList);
      }
    };
    playersRef.on('value', handlePlayersChange);

    return () => {
      stateRef.off('value', handleStateChange);
      playersRef.off('value', handlePlayersChange);
    };
  }, [role]);

  const updateHostState = useCallback((updater: (prev: HostState) => HostState) => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    setHostState(prev => {
      const newState = updater(prev);
      const sanitizedState = JSON.parse(JSON.stringify(newState));
      db.ref(`rooms/${ROOM_ID}/state`).set(sanitizedState);
      return newState;
    });
  }, [role]);

  const resetPlayerAnswers = useCallback(async () => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    const updates: any = {};
    hostState.players.forEach(p => {
        if(p?.id) updates[`rooms/${ROOM_ID}/players/${p.id}/lastAnswerIndex`] = null;
    });
    if (Object.keys(updates).length > 0) await db.ref().update(updates);
  }, [role, hostState.players]);

  const resetPlayerScores = useCallback(async () => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    const updates: any = {};
    hostState.players.forEach(p => {
        if(p?.id) {
            updates[`rooms/${ROOM_ID}/players/${p.id}/score`] = 0;
            updates[`rooms/${ROOM_ID}/players/${p.id}/lastAnswerIndex`] = null;
            updates[`rooms/${ROOM_ID}/players/${p.id}/totalResponseTime`] = 0;
        }
    });
    if (Object.keys(updates).length > 0) await db.ref().update(updates);
  }, [role, hostState.players]);

  const calculateAndSaveScores = useCallback(async () => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    if (!hostState.questions || !hostState.questions[hostState.currentQuestionIndex]) return;

    const currentQ = hostState.questions[hostState.currentQuestionIndex];
    const questionStartTime = hostState.questionStartTime;
    const updates: any = {};
    
    hostState.players.forEach(p => {
      if(!p?.id) return;

      // 正解した場合のみスコア加算とタイム記録を行う
      if (p.lastAnswerIndex === currentQ.correctIndex) {
         const newScore = (p.score || 0) + 10;
         updates[`rooms/${ROOM_ID}/players/${p.id}/score`] = newScore;

         // 正解者の回答スピードを累積（タイマースタートからのミリ秒）
         if (p.lastAnswerTime && questionStartTime) {
            const timeTaken = Math.max(0, p.lastAnswerTime - questionStartTime);
            updates[`rooms/${ROOM_ID}/players/${p.id}/totalResponseTime`] = (p.totalResponseTime || 0) + timeTaken;
         }
      }
    });

    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }
  }, [role, hostState.players, hostState.questions, hostState.currentQuestionIndex, hostState.questionStartTime]);

  const kickPlayer = useCallback(async (id: string) => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    await db.ref(`rooms/${ROOM_ID}/players/${id}`).remove();
  }, [role]);

  const resetAllPlayers = useCallback(async () => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    await db.ref(`rooms/${ROOM_ID}/players`).remove();
  }, [role]);
  
  const toggleOrganizer = useCallback(async (id: string, current: boolean) => {
      if (role !== 'HOST' && role !== 'ADMIN') return;
      await db.ref(`rooms/${ROOM_ID}/players/${id}`).update({ isOrganizer: !current });
  }, [role]);

  const joinGame = useCallback(async (name: string) => {
    if (role !== 'PLAYER') return false;
    const playersRef = db.ref(`rooms/${ROOM_ID}/players`);
    const snapshot = await playersRef.once('value');
    const playersList = Object.values(snapshot.val() || {}) as Player[];
    const existingPlayer = playersList.find(p => p?.name === name);

    let targetId = playerId;
    if (existingPlayer) {
      targetId = existingPlayer.id;
      setPlayerId(targetId);
      localStorage.setItem('quiz_player_id', targetId);
      db.ref(`rooms/${ROOM_ID}/players/${targetId}`).update({ isOnline: true });
    } else {
      if (!targetId) {
        targetId = `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        setPlayerId(targetId);
        localStorage.setItem('quiz_player_id', targetId);
      }
      const player: Player = {
        id: targetId, name, score: 0, lastAnswerIndex: null, lastAnswerTime: 0, totalResponseTime: 0, isOnline: true, isOrganizer: false
      };
      await db.ref(`rooms/${ROOM_ID}/players/${targetId}`).set(player);
    }
    return true;
  }, [role, playerId]);

  const submitAnswer = useCallback((index: number) => {
    if (role !== 'PLAYER') return;
    db.ref(`rooms/${ROOM_ID}/players/${playerId}`).update({
      lastAnswerIndex: index,
      lastAnswerTime: Date.now()
    });
  }, [role, playerId]);

  return { hostState, playerId, joinError, updateHostState, joinGame, submitAnswer, resetPlayerAnswers, resetPlayerScores, calculateAndSaveScores, kickPlayer, resetAllPlayers, toggleOrganizer };
};
