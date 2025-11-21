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
  // 1. Host creates/resets the room state in Firebase
  // 2. Host listens for 'commands' (joins, answers) from players
  // 3. Host updates 'gameState' which players listen to

  // Initialize Room (Host Only)
  useEffect(() => {
    if (role !== 'HOST') return;

    const stateRef = ref(db, `rooms/${ROOM_ID}/state`);
    
    // Subscribe to state changes (to keep local host UI in sync if updated elsewhere, 
    // though mainly host drives the state)
    const unsubscribeState = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setHostState(data);
      } else {
        // If no state exists, initialize it
        set(stateRef, INITIAL_HOST_STATE);
      }
    });

    // Listen for player commands (Joins, Answers)
    const commandsRef = ref(db, `rooms/${ROOM_ID}/commands`);
    const unsubscribeCommands = onValue(commandsRef, (snapshot) => {
      const commands = snapshot.val();
      if (!commands) return;

      // Process all pending commands
      let stateChanged = false;
      
      // We need to get the current latest state to modify it
      // Note: In a high concurrency real app, we'd use transactions. 
      // For a party, reading local state or snapshot is acceptable.
      
      // We use a functional update in 'updateHostState' usually, but here we are reacting to DB.
      // Let's fetch the latest state ref to be sure.
    });
    
    // Instead of complex command queue, let's use a simpler "Direct Write" approach 
    // for the party to reduce latency and complexity.
    // Players write to /players/{id} and /answers/{id}
    
    const playersRef = ref(db, `rooms/${ROOM_ID}/players`);
    const answersRef = ref(db, `rooms/${ROOM_ID}/answers`);

    const unsubPlayers = onValue(playersRef, (snap) => {
      const playersObj = snap.val() || {};
      const playersList = Object.values(playersObj) as Player[];
      
      setHostState(prev => ({
        ...prev,
        players: playersList
      }));
    });

    return () => {
      unsubscribeState();
      unsubPlayers();
    };
  }, [role]);


  // --- PLAYER LOGIC ---
  // Players just listen to /state and write to their own nodes
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
  
  // Host updates the central state
  const updateHostState = useCallback((updater: (prev: HostState) => HostState) => {
    if (role !== 'HOST') return;

    setHostState(prev => {
      const newState = updater(prev);
      // Sync to Firebase
      const stateRef = ref(db, `rooms/${ROOM_ID}/state`);
      
      // Optimized update: specific fields or whole object
      // For simplicity, update whole object
      set(stateRef, newState).catch(err => console.error("Firebase update failed", err));
      
      return newState;
    });
  }, [role]);


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

    // Write to players node
    const playerRef = ref(db, `rooms/${ROOM_ID}/players/${playerId}`);
    set(playerRef, player);

    // Setup disconnect cleanup (remove player if they close browser? Optional. 
    // For a quiz, maybe keep them. Let's keep them.)
  }, [role, playerId]);

  const submitAnswer = useCallback((index: number) => {
    if (role !== 'PLAYER') return;
    
    // In this architecture, we update the player object directly in the DB
    // The Host is listening to the 'players' node and will see the change.
    
    // First get current player state to not wipe score
    // (Actually, host manages score. Player just signals answer.)
    
    // Problem: If player writes directly to /players/id, they might overwrite score updates from host.
    // Solution: Player writes to `lastAnswerIndex` field ONLY.
    
    const answerRef = ref(db, `rooms/${ROOM_ID}/players/${playerId}/lastAnswerIndex`);
    const timeRef = ref(db, `rooms/${ROOM_ID}/players/${playerId}/lastAnswerTime`);
    
    set(answerRef, index);
    set(timeRef, Date.now());

  }, [role, playerId]);


  return {
    hostState,
    playerId,
    updateHostState, // For Host
    joinGame,        // For Player
    submitAnswer     // For Player
  };
};
