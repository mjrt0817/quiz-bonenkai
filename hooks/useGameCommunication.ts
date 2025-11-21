import { useState, useEffect, useCallback } from 'react';
import { GameState, HostState, Player } from '../types';
import { db } from '../services/firebaseConfig';
import { ref, set, onValue, update, remove, get } from 'firebase/database';

const ROOM_ID = 'party-room-2024';

const INITIAL_HOST_STATE: HostState = {
  gameState: GameState.SETUP,
  currentQuestionIndex: 0,
  questions: [],
  players: [],
  roomCode: 'EVENT',
  timeLimit: 20,
  questionStartTime: null,
};

export const useGameCommunication = (role: 'HOST' | 'PLAYER' | 'ADMIN') => {
  const [hostState, setHostState] = useState<HostState>(INITIAL_HOST_STATE);
  const [playerId, setPlayerId] = useState(() => localStorage.getItem('quiz_player_id') || '');
  const [joinError, setJoinError] = useState<string | null>(null);

  // --- SYNC STATE (ALL ROLES) ---
  useEffect(() => {
    // Subscribe to global state
    const stateRef = ref(db, `rooms/${ROOM_ID}/state`);
    const unsubscribeState = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setHostState(data);
      } else if (role === 'HOST' || role === 'ADMIN') {
        // If no state exists and we are host/admin, initialize it
        set(stateRef, INITIAL_HOST_STATE);
      }
    });
    
    // Subscribe to players list separately for realtime updates
    const playersRef = ref(db, `rooms/${ROOM_ID}/players`);
    const unsubPlayers = onValue(playersRef, (snap) => {
      const playersObj = snap.val() || {};
      const playersList = Object.values(playersObj) as Player[];
      
      // Update local state with latest players
      setHostState(prev => ({ ...prev, players: playersList }));
      
      // HOST/ADMIN responsibility: Keep the 'state.players' in sync with 'players' node
      // This ensures redundancy and consistency
      if (role === 'HOST' || role === 'ADMIN') {
         const statePlayersRef = ref(db, `rooms/${ROOM_ID}/state/players`);
         set(statePlayersRef, playersList).catch(err => console.error("Sync players failed", err));
      }
    });

    return () => {
      unsubscribeState();
      unsubPlayers();
    };
  }, [role]);


  // --- ADMIN / HOST ACTIONS ---
  
  const updateHostState = useCallback((updater: (prev: HostState) => HostState) => {
    if (role !== 'HOST' && role !== 'ADMIN') return;

    setHostState(prev => {
      const newState = updater(prev);
      const stateRef = ref(db, `rooms/${ROOM_ID}/state`);
      set(stateRef, newState).catch(err => console.error("Firebase update failed", err));
      return newState;
    });
  }, [role]);

  const resetPlayerAnswers = useCallback(async () => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    const updates: any = {};
    hostState.players.forEach(p => {
        updates[`rooms/${ROOM_ID}/players/${p.id}/lastAnswerIndex`] = null;
    });
    if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
    }
  }, [role, hostState.players]);

  const resetPlayerScores = useCallback(async () => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    const updates: any = {};
    hostState.players.forEach(p => {
        updates[`rooms/${ROOM_ID}/players/${p.id}/score`] = 0;
        updates[`rooms/${ROOM_ID}/players/${p.id}/lastAnswerIndex`] = null;
    });
    if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
    }
  }, [role, hostState.players]);

  const kickPlayer = useCallback(async (targetPlayerId: string) => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    await remove(ref(db, `rooms/${ROOM_ID}/players/${targetPlayerId}`));
  }, [role]);

  const resetAllPlayers = useCallback(async () => {
    if (role !== 'HOST' && role !== 'ADMIN') return;
    await remove(ref(db, `rooms/${ROOM_ID}/players`));
  }, [role]);


  // --- PLAYER ACTIONS ---

  const joinGame = useCallback(async (name: string) => {
    if (role !== 'PLAYER') return false;
    setJoinError(null);
    
    // Check for duplicate name
    const playersRef = ref(db, `rooms/${ROOM_ID}/players`);
    const snapshot = await get(playersRef);
    const playersObj = snapshot.val() || {};
    const playersList = Object.values(playersObj) as Player[];
    
    const existingPlayer = playersList.find(p => p.name === name);

    let targetId = playerId;

    if (existingPlayer) {
      // RECOVERY LOGIC: Name exists, so we assume it's the same person reconnecting
      targetId = existingPlayer.id;
      setPlayerId(targetId);
      localStorage.setItem('quiz_player_id', targetId);
      
      // Update status (optional)
      const playerRef = ref(db, `rooms/${ROOM_ID}/players/${targetId}`);
      update(playerRef, { isOnline: true });
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
        isOnline: true
      };
      const playerRef = ref(db, `rooms/${ROOM_ID}/players/${targetId}`);
      await set(playerRef, player);
    }
    return true;
  }, [role, playerId]);

  const submitAnswer = useCallback((index: number) => {
    if (role !== 'PLAYER') return;
    
    const answerRef = ref(db, `rooms/${ROOM_ID}/players/${playerId}/lastAnswerIndex`);
    const timeRef = ref(db, `rooms/${ROOM_ID}/players/${playerId}/lastAnswerTime`);
    
    set(answerRef, index);
    set(timeRef, Date.now());
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
    kickPlayer,
    resetAllPlayers
  };
};
