import { useState, useEffect, useCallback } from 'react';
import { GameState, HostState, Player } from '../types';
import { db } from '../services/firebaseConfig';
// Using firebase/compat/database via db instance instead of modular imports
// import { ref, set, onValue, update, remove, get } from 'firebase/database';

const ROOM_ID = 'party-room-2024';

const INITIAL_HOST_STATE: HostState = {
  gameState: GameState.SETUP,
  currentQuestionIndex: 0,
  questions: [],
  players: [],
  roomCode: 'EVENT',
  timeLimit: 20,
  questionStartTime: null,
  rankingRevealStage: 0,
  isRankingResultVisible: false,
  hideBelowTop3: false,
  quizTitle: 'クイズ大会',
  titleImage: null,
  isLobbyDetailsVisible: false,
};

export const useGameCommunication = (role: 'HOST' | 'PLAYER' | 'ADMIN') => {
  const [hostState, setHostState] = useState<HostState>(INITIAL_HOST_STATE);
  const [playerId, setPlayerId] = useState(() => localStorage.getItem('quiz_player_id') || '');
  const [joinError, setJoinError] = useState<string | null>(null);

  // --- SYNC STATE (ALL ROLES) ---
  useEffect(() => {
    // Subscribe to global state
    const stateRef = db.ref(`rooms/${ROOM_ID}/state`);
    
    const handleStateChange = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        // Ensure basic structure prevents crashes
        setHostState({
            ...INITIAL_HOST_STATE,
            ...data,
            questions: data.questions || [],
            players: data.players || []
        });
      } else if (role === 'HOST' || role === 'ADMIN') {
        // If no state exists and we are host/admin, initialize it
        stateRef.set(INITIAL_HOST_STATE);
      }
    };

    stateRef.on('value', handleStateChange);
    
    // Subscribe to players list separately for realtime updates
    const playersRef = db.ref(`rooms/${ROOM_ID}/players`);
    
    const handlePlayersChange = (snap: any) => {
      const playersObj = snap.val() || {};
      const playersList = Object.values(playersObj) as Player[];
      
      // Update local state with latest players
      setHostState(prev => ({ ...prev, players: playersList }));
      
      // HOST/ADMIN responsibility: Keep the 'state.players' in sync with 'players' node
      // This ensures redundancy and consistency
      if (role === 'HOST' || role === 'ADMIN') {
         const statePlayersRef = db.ref(`rooms/${ROOM_ID}/state/players`);
         statePlayersRef.set(playersList).catch(err => console.error("Sync players failed", err));
      }
    };

    playersRef.on('value', handlePlayersChange);

    return () => {
      stateRef.off('value', handleStateChange);
      playersRef.off('value', handlePlayersChange);
    };
  }, [role]);


  // --- ADMIN / HOST ACTIONS ---
  
  const updateHostState = useCallback((updater: (prev: HostState) => HostState) => {
    if (role !== 'HOST' && role !== 'ADMIN') return;

    setHostState(prev => {
      const newState = updater(prev);
      const stateRef = db.ref(`rooms/${ROOM_ID}/state`);
      stateRef.set(newState).catch(err => console.error("Firebase update failed", err));
      return newState;
    });
  }, [role]);

  const resetPlayerAnswers = useCallback(async () => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    if (hostState.players.length === 0) return;
    
    const updates: any = {};
    hostState.players.forEach(p => {
        updates[`rooms/${ROOM_ID}/players/${p.id}/lastAnswerIndex`] = null;
    });
    if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
    }
  }, [role, hostState.players]);

  const resetPlayerScores = useCallback(async () => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    if (hostState.players.length === 0) return;

    const updates: any = {};
    hostState.players.forEach(p => {
        updates[`rooms/${ROOM_ID}/players/${p.id}/score`] = 0;
        updates[`rooms/${ROOM_ID}/players/${p.id}/lastAnswerIndex`] = null;
        updates[`rooms/${ROOM_ID}/players/${p.id}/totalResponseTime`] = 0;
    });
    if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
    }
  }, [role, hostState.players]);

  const calculateAndSaveScores = useCallback(async () => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    if (!hostState.questions || !hostState.questions[hostState.currentQuestionIndex]) return;

    const currentQ = hostState.questions[hostState.currentQuestionIndex];
    const questionStartTime = hostState.questionStartTime;
    const updates: any = {};
    
    hostState.players.forEach(p => {
      // Calculate Time Difference (Tie Breaker)
      // We accumulate time taken for ALL answers (or you could restrict to only correct ones)
      // Here we accumulate time for any answer submitted to break ties based on "speed of participation"
      if (p.lastAnswerIndex !== null && p.lastAnswerIndex !== undefined && p.lastAnswerTime && questionStartTime) {
          const timeTaken = Math.max(0, p.lastAnswerTime - questionStartTime);
          const currentTotal = p.totalResponseTime || 0;
          updates[`rooms/${ROOM_ID}/players/${p.id}/totalResponseTime`] = currentTotal + timeTaken;
      }

      // Calculate Score
      if (p.lastAnswerIndex === currentQ.correctIndex) {
         const newScore = (p.score || 0) + 10; // 10 points per correct answer
         updates[`rooms/${ROOM_ID}/players/${p.id}/score`] = newScore;
      }
    });

    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }
  }, [role, hostState.players, hostState.questions, hostState.currentQuestionIndex, hostState.questionStartTime]);

  const kickPlayer = useCallback(async (targetPlayerId: string) => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    await db.ref(`rooms/${ROOM_ID}/players/${targetPlayerId}`).remove();
  }, [role]);

  const resetAllPlayers = useCallback(async () => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    await db.ref(`rooms/${ROOM_ID}/players`).remove();
  }, [role]);


  // --- PLAYER ACTIONS ---

  const joinGame = useCallback(async (name: string) => {
    if (role !== 'PLAYER') return false;
    setJoinError(null);
    
    // Check existing players
    const playersRef = db.ref(`rooms/${ROOM_ID}/players`);
    const snapshot = await playersRef.once('value');
    const playersObj = snapshot.val() || {};
    const playersList = Object.values(playersObj) as Player[];
    
    const existingPlayer = playersList.find(p => p.name === name);

    let targetId = playerId;

    if (existingPlayer) {
      // RECOVERY LOGIC
      targetId = existingPlayer.id;
      setPlayerId(targetId);
      localStorage.setItem('quiz_player_id', targetId);
      
      const playerRef = db.ref(`rooms/${ROOM_ID}/players/${targetId}`);
      playerRef.update({ isOnline: true });
    } else {
      // NEW PLAYER
      if (!targetId) {
        targetId = `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        setPlayerId(targetId);
        localStorage.setItem('quiz_player_id', targetId);
      }
      
      const player: Player = {
        id: targetId,
        name,
        score: 0,
        lastAnswerIndex: null,
        lastAnswerTime: 0,
        totalResponseTime: 0,
        isOnline: true
      };
      const playerRef = db.ref(`rooms/${ROOM_ID}/players/${targetId}`);
      await playerRef.set(player);
    }
    return true;
  }, [role, playerId]);

  const submitAnswer = useCallback((index: number) => {
    if (role !== 'PLAYER') return;
    
    const answerRef = db.ref(`rooms/${ROOM_ID}/players/${playerId}/lastAnswerIndex`);
    const timeRef = db.ref(`rooms/${ROOM_ID}/players/${playerId}/lastAnswerTime`);
    
    // Player just sends their timestamp. The host will calculate the duration relative to question start.
    answerRef.set(index);
    timeRef.set(Date.now());
  }, [role, playerId]);


  return {
    hostState,
    playerId,
    joinError,
    updateHostState,
    joinGame,
    submitAnswer,
    resetPlayerAnswers,
    resetPlayerScores,
    calculateAndSaveScores,
    kickPlayer,
    resetAllPlayers
  };
};
