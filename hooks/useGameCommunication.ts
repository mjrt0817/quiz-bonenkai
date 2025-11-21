import { useState, useEffect, useCallback, useRef } from 'react';
import { BroadcastMessage, GameState, HostState, Player } from '../types';
import { db } from '../services/firebaseConfig';
import { ref, set, onValue, push, remove, onDisconnect, update } from 'firebase/database';

// Using a fixed room ID for simplicity for the event
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

export const useGameCommunication = (role: 'HOST' | 'PLAYER') => {
  const [hostState, setHostState] = useState<HostState>(INITIAL_HOST_STATE);
  const [playerId] = useState(() => {
    const stored = localStorage.getItem('quiz_player_id');
    if (stored) return stored;
    const newId = `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    localStorage.setItem('quiz_player_id', newId);
    return newId;
  });

  // --- HOST LOGIC ---
  useEffect(() => {
    if (role !== 'HOST') return;

    const stateRef = ref(db, `rooms/${ROOM_ID}/state`);
    
    const unsubscribeState = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setHostState(data);
      } else {
        set(stateRef, INITIAL_HOST_STATE);
      }
    });
    
    const playersRef = ref(db, `rooms/${ROOM_ID}/players`);

    const unsubPlayers = onValue(playersRef, (snap) => {
      const playersObj = snap.val() || {};
      const playersList = Object.values(playersObj) as Player[];
      
      setHostState(prev => {
        const newState = {
          ...prev,
          players: playersList
        };
        
        // CRITICAL FIX: Sync updated player list (with answers) back to shared state
        // This ensures players see their updated status immediately
        const statePlayersRef = ref(db, `rooms/${ROOM_ID}/state/players`);
        set(statePlayersRef, playersList).catch(err => console.error("Sync players failed", err));
        
        return newState;
      });
    });

    return () => {
      unsubscribeState();
      unsubPlayers();
    };
  }, [role]);


  // --- PLAYER LOGIC ---
  useEffect(() => {
    if (role !== 'PLAYER') return;

    const stateRef = ref(db, `rooms/${ROOM_ID}/state`);
    const unsubscribe = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setHostState(data);
      }
    });

    return () => unsubscribe();
  }, [role]);


  // --- HOST ACTIONS ---
  
  const updateHostState = useCallback((updater: (prev: HostState) => HostState) => {
    if (role !== 'HOST') return;

    setHostState(prev => {
      const newState = updater(prev);
      const stateRef = ref(db, `rooms/${ROOM_ID}/state`);
      set(stateRef, newState).catch(err => console.error("Firebase update failed", err));
      return newState;
    });
  }, [role]);

  // Reset all players' answer index to null (for next question)
  const resetPlayerAnswers = useCallback(async () => {
    if (role !== 'HOST') return;
    const updates: any = {};
    hostState.players.forEach(p => {
        updates[`rooms/${ROOM_ID}/players/${p.id}/lastAnswerIndex`] = null;
    });
    if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
    }
  }, [role, hostState.players]);

  // Reset scores and answers (for new game)
  const resetPlayerScores = useCallback(async () => {
    if (role !== 'HOST') return;
    const updates: any = {};
    hostState.players.forEach(p => {
        updates[`rooms/${ROOM_ID}/players/${p.id}/score`] = 0;
        updates[`rooms/${ROOM_ID}/players/${p.id}/lastAnswerIndex`] = null;
    });
    if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
    }
  }, [role, hostState.players]);


  // --- PLAYER ACTIONS ---

  const joinGame = useCallback((name: string) => {
    if (role !== 'PLAYER') return;
    
    const player: Player = {
      id: playerId,
      name,
      score: 0,
      lastAnswerIndex: null,
      lastAnswerTime: 0
    };

    const playerRef = ref(db, `rooms/${ROOM_ID}/players/${playerId}`);
    set(playerRef, player);
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
    updateHostState,
    joinGame,
    submitAnswer,
    resetPlayerAnswers,
    resetPlayerScores
  };
};
