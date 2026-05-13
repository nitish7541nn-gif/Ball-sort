/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RotateCcw, 
  Undo2, 
  Lightbulb, 
  ChevronRight, 
  Trophy, 
  Lock,
  Volume2,
  VolumeX,
  Play,
  Coins
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import confetti from 'canvas-confetti';

// --- Constants & Types ---

const WIN_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3';
const MOVE_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3';

let db: any = null;
let auth: any = null;
let googleProvider: any = null;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Ball {
  id: string;
  color: string;
}

type Tube = Ball[];

interface LevelData {
  id: number;
  initialTubes: Tube[];
}

const COLORS = {
  RED: '#fd2d2d',
  BLUE: '#14b1ff',
  GREEN: '#00ff41',
  YELLOW: '#ffff00',
  PURPLE: '#cc00ff',
  ORANGE: '#ff9900',
  BROWN: '#cd853f',
  PINK: '#ff007f',
  CYAN: '#00ffff',
  GRAY: '#e2e8f0'
};

const COLOR_MAP: Record<string, string> = {
  'Red': COLORS.RED,
  'Blue': COLORS.BLUE,
  'Green': COLORS.GREEN,
  'Yellow': COLORS.YELLOW,
  'Purple': COLORS.PURPLE,
  'Orange': COLORS.ORANGE,
  'Brown': COLORS.BROWN,
  'Pink': COLORS.PINK,
  'Cyan': COLORS.CYAN,
  'Gray': COLORS.GRAY,
};

// --- Level Generation ---

const generateLevels = (): LevelData[] => {
  const levels: LevelData[] = [
    {
      id: 1,
      initialTubes: [
        [{ id: '1-1', color: 'Red' }, { id: '1-2', color: 'Red' }, { id: '1-3', color: 'Blue' }, { id: '1-4', color: 'Blue' }],
        [{ id: '1-5', color: 'Blue' }, { id: '1-6', color: 'Blue' }, { id: '1-7', color: 'Red' }, { id: '1-8', color: 'Red' }],
        [],
        []
      ]
    },
    {
      id: 2,
      initialTubes: [
        [{ id: '2-1', color: 'Red' }, { id: '2-2', color: 'Green' }, { id: '2-3', color: 'Red' }, { id: '2-4', color: 'Green' }],
        [{ id: '2-5', color: 'Green' }, { id: '2-6', color: 'Red' }, { id: '2-7', color: 'Green' }, { id: '2-8', color: 'Red' }],
        [{ id: '2-9', color: 'Blue' }, { id: '2-10', color: 'Blue' }, { id: '2-11', color: 'Blue' }, { id: '2-12', color: 'Blue' }],
        [],
        []
      ]
    },
    {
      id: 3,
      initialTubes: [
        [{ id: '3-1', color: 'Red' }, { id: '3-2', color: 'Blue' }, { id: '3-3', color: 'Green' }, { id: '3-4', color: 'Yellow' }],
        [{ id: '3-5', color: 'Yellow' }, { id: '3-6', color: 'Green' }, { id: '3-7', color: 'Blue' }, { id: '3-8', color: 'Red' }],
        [{ id: '3-9', color: 'Red' }, { id: '3-10', color: 'Blue' }, { id: '3-11', color: 'Green' }, { id: '3-12', color: 'Yellow' }],
        [{ id: '3-13', color: 'Yellow' }, { id: '3-14', color: 'Green' }, { id: '3-15', color: 'Blue' }, { id: '3-16', color: 'Red' }],
        [],
        []
      ]
    },
    {
      id: 4,
      initialTubes: [
        [{ id: '4-1', color: 'Purple' }, { id: '4-2', color: 'Orange' }, { id: '4-3', color: 'Purple' }, { id: '4-4', color: 'Orange' }],
        [{ id: '4-5', color: 'Orange' }, { id: '4-6', color: 'Purple' }, { id: '4-7', color: 'Orange' }, { id: '4-8', color: 'Purple' }],
        [{ id: '4-9', color: 'Red' }, { id: '4-10', color: 'Red' }, { id: '4-11', color: 'Green' }, { id: '4-12', color: 'Green' }],
        [{ id: '4-13', color: 'Green' }, { id: '4-14', color: 'Green' }, { id: '4-15', color: 'Red' }, { id: '4-16', color: 'Red' }],
        [{ id: '4-17', color: 'Blue' }, { id: '4-18', color: 'Blue' }, { id: '4-19', color: 'Blue' }, { id: '4-20', color: 'Blue' }],
        [],
        []
      ]
    }
  ];

  for (let i = 5; i <= 200; i++) {
    let colorsAvailable;
    if (i < 16) colorsAvailable = 5;
    else if (i < 31) colorsAvailable = 6;
    else if (i < 46) colorsAvailable = 7;
    else if (i < 76) colorsAvailable = 8;
    else if (i < 126) colorsAvailable = 9;
    else colorsAvailable = 10;

    const colorNames = Object.keys(COLOR_MAP).slice(0, colorsAvailable);
    const allBalls: Ball[] = [];
    
    colorNames.forEach((color, cIdx) => {
      for (let j = 0; j < 4; j++) {
        allBalls.push({ id: `l${i}-c${cIdx}-b${j}`, color });
      }
    });

    for (let j = allBalls.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [allBalls[j], allBalls[k]] = [allBalls[k], allBalls[j]];
    }

    const numTubes = colorsAvailable + 2;
    const initialTubes: Tube[] = Array.from({ length: numTubes }, () => []);
    let ballIdx = 0;
    for (let t = 0; t < colorsAvailable; t++) {
      for (let b = 0; b < 4; b++) {
        initialTubes[t].push(allBalls[ballIdx++]);
      }
    }
    levels.push({ id: i, initialTubes });
  }
  return levels;
};

const LEVELS = generateLevels();

const TUBE_CAPACITY = 4;

// --- Components ---

// --- Components for Performance ---

const MemoizedBall = memo(({ ball, isSelected }: { ball: Ball, isSelected: boolean }) => (
  <motion.div
    layoutId={ball.id}
    initial={{ y: -50, opacity: 0 }}
    animate={{ y: isSelected ? -40 : 0, opacity: 1, scale: isSelected ? 1.05 : 1 }}
    transition={{ type: "spring", stiffness: 600, damping: 30, mass: 0.8 }}
    className="w-10 h-10 md:w-12 md:h-12 rounded-full mb-1 flex-shrink-0 relative shadow-lg transform-gpu"
    style={{ 
      backgroundColor: COLOR_MAP[ball.color], 
      boxShadow: `inset 0 0 15px rgba(0,0,0,0.3)`,
      willChange: 'transform, opacity'
    }}
  >
    <div className="absolute top-1 left-2 w-3 h-2 bg-white/40 rounded-full blur-[0.5px] rotate-[-20deg]" />
    <div className="absolute bottom-1 right-2 w-1.5 h-1.5 bg-black/10 rounded-full blur-[0.5px]" />
  </motion.div>
));

const TubeComponent = memo(({ 
  tube, 
  index, 
  isSelected, 
  onSelect, 
  canDrop 
}: { 
  tube: Tube, 
  index: number, 
  isSelected: boolean, 
  onSelect: (i: number) => void, 
  canDrop: boolean 
}) => {
  return (
    <div
      onClick={() => onSelect(index)}
      className={`w-14 md:w-16 h-48 md:h-52 rounded-b-3xl rounded-t-lg border-x-4 border-b-4 flex flex-col-reverse items-center pb-2 cursor-pointer transition-all relative transform-gpu
        ${isSelected ? 'border-blue-400 bg-blue-400/10 shadow-[0_0_20px_rgba(96,165,250,0.3)]' : 'border-white/20 bg-white/5'}
        ${canDrop ? 'border-emerald-400/50 bg-emerald-400/5' : ''}
        hover:border-white/40
      `}
      style={{ willChange: 'border-color, background-color' }}
    >
      {/* Glossy overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent rounded-b-3xl pointer-events-none" />
      
      <AnimatePresence mode="popLayout" initial={false}>
        {tube.map((ball, bIdx) => (
          <MemoizedBall 
            key={ball.id} 
            ball={ball} 
            isSelected={isSelected && bIdx === tube.length - 1} 
          />
        ))}
      </AnimatePresence>
    </div>
  );
});

export default function App() {
  const [view, setView] = useState<'home' | 'levels' | 'game'>('home');
  const [completedLevels, setCompletedLevels] = useState<number[]>([]);
  const [purchasedLevels, setPurchasedLevels] = useState<number[]>([]);
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [tubes, setTubes] = useState<Tube[]>([]);
  const [history, setHistory] = useState<Tube[][]>([]);
  const [selectedTubeIndex, setSelectedTubeIndex] = useState<number | null>(null);
  const [isWon, setIsWon] = useState(false);
  const [hint, setHint] = useState<{ from: number, to: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [coins, setCoins] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDailyChallenge, setIsDailyChallenge] = useState(false);
  const [isEndlessMode, setIsEndlessMode] = useState(false);
  const [endlessLevel, setEndlessLevel] = useState<LevelData | null>(null);
  const [dailyCompletedDate, setDailyCompletedDate] = useState<string | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState<number | null>(null);

  const lastSyncedState = useRef<string>("");

  const currentLevel = useMemo(() => {
    if (isDailyChallenge) {
      const date = new Date().toISOString().split('T')[0];
      const day = new Date().getDate();
      const dailyLevelIdx = 100 + (day % 100);
      return { ...LEVELS[dailyLevelIdx], id: -1, isDaily: true };
    }
    if (isEndlessMode && endlessLevel) {
      return endlessLevel;
    }
    return LEVELS[currentLevelIdx] || LEVELS[0];
  }, [currentLevelIdx, isDailyChallenge, isEndlessMode, endlessLevel]);

  const moveSound = useMemo(() => {
    const audio = new Audio(MOVE_SOUND_URL);
    audio.preload = 'auto';
    return audio;
  }, []);
  const winSound = useMemo(() => {
    const audio = new Audio(WIN_SOUND_URL);
    audio.preload = 'auto';
    return audio;
  }, []);

  const playSound = useCallback((audio: HTMLAudioElement) => {
    if (isMuted) return;
    try {
      audio.currentTime = 0;
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {
      console.warn("Sound play failed", e);
    }
  }, [isMuted]);

  // Auth & Cloud Sync
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u as User);
      if (u) loadFromCloud(u.uid);
    });
  }, []);

  const login = async () => {
    if (!auth || !googleProvider) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const loadFromCloud = async (userId: string) => {
    if (!db) return;
    setIsSyncing(true);
    try {
      const docRef = doc(db, 'user_progress', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.coins !== undefined) setCoins(data.coins);
        if (data.completedLevels) setCompletedLevels(data.completedLevels);
        if (data.purchasedLevels) setPurchasedLevels(data.purchasedLevels);
        if (data.lastPlayedLevelIdx !== undefined) setCurrentLevelIdx(data.lastPlayedLevelIdx);
        if (data.dailyChallengeDate) setDailyCompletedDate(data.dailyChallengeDate);
        
        // Initial state hash for comparison
        lastSyncedState.current = JSON.stringify({
          coins: data.coins,
          completedLevels: data.completedLevels,
          purchasedLevels: data.purchasedLevels,
          lastPlayedLevelIdx: data.lastPlayedLevelIdx,
          dailyCompletedDate: data.dailyChallengeDate
        });
      }
    } catch (error) {
      console.error("Error loading progress", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncToCloud = useCallback(async () => {
    if (!user || isSyncing || !db) return;
    
    // Check if anything actually changed before writing to Firestore
    const currentState = JSON.stringify({
      coins,
      completedLevels,
      purchasedLevels,
      lastPlayedLevelIdx: currentLevelIdx,
      dailyCompletedDate
    });

    if (currentState === lastSyncedState.current) return;

    setIsSyncing(true);
    try {
      await setDoc(doc(db, 'user_progress', user.uid), {
        userId: user.uid,
        coins,
        completedLevels,
        purchasedLevels,
        lastPlayedLevelIdx: currentLevelIdx,
        lastUpdated: serverTimestamp(),
        dailyChallengeDate: dailyCompletedDate
      }, { merge: true });
      
      lastSyncedState.current = currentState;
    } catch (error) {
      console.error("Error syncing progress", error);
    } finally {
      setIsSyncing(false);
    }
  }, [user, coins, completedLevels, purchasedLevels, currentLevelIdx, dailyCompletedDate, isSyncing]);

  useEffect(() => {
    if (user) {
      const timeout = setTimeout(() => syncToCloud(), 5000); // Debounce sync
      return () => clearTimeout(timeout);
    }
  }, [coins, completedLevels, purchasedLevels, currentLevelIdx, syncToCloud, user]);


  // Initialize from LocalStorage (Fallback/Default)
  useEffect(() => {
    const savedLevel = localStorage.getItem('ball-sort-puzzle-level');
    const savedCompleted = localStorage.getItem('ball-sort-completed-levels');
    const savedPurchased = localStorage.getItem('ball-sort-purchased-levels');
    const savedCoins = localStorage.getItem('ball-sort-coins');
    
    if (savedCoins) setCoins(parseInt(savedCoins));

    if (savedPurchased) {
      try {
        setPurchasedLevels(JSON.parse(savedPurchased));
      } catch (e) {
        setPurchasedLevels([]);
      }
    }

    let loadedCompleted: number[] = [];
    if (savedCompleted) {
      try {
        loadedCompleted = JSON.parse(savedCompleted);
        setCompletedLevels(loadedCompleted);
      } catch (e) {
        setCompletedLevels([]);
      }
    }

    if (savedLevel) {
      setCurrentLevelIdx(parseInt(savedLevel));
    } else {
      // If no saved level, start at the first uncompleted level
      let furthest = 0;
      while (loadedCompleted.includes(furthest) && furthest < LEVELS.length - 1) {
        furthest++;
      }
      setCurrentLevelIdx(furthest);
    }
  }, []);

  const handlePlayNow = () => {
    // If the current level is already completed, automatically jump to the next uncompleted level
    let targetIdx = currentLevelIdx;
    if (completedLevels.includes(targetIdx)) {
      while (completedLevels.includes(targetIdx) && targetIdx < LEVELS.length - 1) {
        targetIdx++;
      }
    }
    setCurrentLevelIdx(targetIdx);
    setView('game');
  };

  useEffect(() => {
    // Fast shallow copy
    setTubes(currentLevel.initialTubes.map(tube => [...tube]));
    setHistory([]);
    setSelectedTubeIndex(null);
    setIsWon(false);
    setHint(null);
    localStorage.setItem('ball-sort-puzzle-level', currentLevelIdx.toString());
  }, [currentLevelIdx, currentLevel]);

  useEffect(() => {
    localStorage.setItem('ball-sort-completed-levels', JSON.stringify(completedLevels));
  }, [completedLevels]);

  useEffect(() => {
    localStorage.setItem('ball-sort-purchased-levels', JSON.stringify(purchasedLevels));
  }, [purchasedLevels]);

  useEffect(() => {
    localStorage.setItem('ball-sort-coins', coins.toString());
  }, [coins]);

  const checkWin = useCallback((currentTubes: Tube[]) => {
    for (const tube of currentTubes) {
      if (tube.length === 0) continue;
      if (tube.length !== TUBE_CAPACITY) return false;
      const firstColor = tube[0].color;
      if (!tube.every(ball => ball.color === firstColor)) return false;
    }
    return true;
  }, []);

  const generateEndlessLevel = (): LevelData => {
    const colorsAvailable = Math.floor(Math.random() * 4) + 7; // 7 to 10 colors
    const colorNames = Object.keys(COLOR_MAP).slice(0, colorsAvailable);
    const allBalls: Ball[] = [];
    colorNames.forEach((color, cIdx) => {
      for (let j = 0; j < 4; j++) {
        allBalls.push({ id: `endless-${Date.now()}-c${cIdx}-b${j}`, color });
      }
    });
    for (let j = allBalls.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [allBalls[j], allBalls[k]] = [allBalls[k], allBalls[j]];
    }
    const numTubes = colorsAvailable + 2;
    const initialTubes: Tube[] = Array.from({ length: numTubes }, () => []);
    let ballIdx = 0;
    for (let t = 0; t < colorsAvailable; t++) {
      for (let b = 0; b < 4; b++) {
        initialTubes[t].push(allBalls[ballIdx++]);
      }
    }
    return { id: 0, initialTubes };
  };

  const startEndless = () => {
    setEndlessLevel(generateEndlessLevel());
    setIsEndlessMode(true);
    setView('game');
  };

  const triggerWin = () => {
    setIsWon(true);
    playSound(winSound);
    
    if (isDailyChallenge) {
      const date = new Date().toISOString().split('T')[0];
      if (dailyCompletedDate !== date) {
        setCoins(prev => prev + 200); 
        setDailyCompletedDate(date);
      }
    } else if (isEndlessMode) {
      setCoins(prev => prev + 100);
    } else if (!completedLevels.includes(currentLevelIdx)) {
      setCompletedLevels(prev => [...prev, currentLevelIdx]);
      setCoins(prev => prev + 50);
    }
    
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: Object.values(COLORS)
    });
  };

  const moveBall = (fromIndex: number, toIndex: number) => {
    if (!canMove(fromIndex, toIndex)) {
      setSelectedTubeIndex(null);
      return;
    }
    
    setHistory([...history, tubes.map(t => [...t])]);
    
    const newTubes = tubes.map((tube, i) => {
      if (i === fromIndex) return tube.slice(0, -1);
      if (i === toIndex) return [...tube, tubes[fromIndex][tubes[fromIndex].length - 1]];
      return tube;
    });

    playSound(moveSound);
    setTubes(newTubes);
    setSelectedTubeIndex(null);
    setHint(null);
    if (checkWin(newTubes)) triggerWin();
  };

  const undo = () => {
    if (history.length === 0 || isWon) return;
    setTubes(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setSelectedTubeIndex(null);
    setHint(null);
  };

  const restart = () => {
    setTubes(currentLevel.initialTubes.map(tube => [...tube]));
    setHistory([]);
    setSelectedTubeIndex(null);
    setIsWon(false);
    setHint(null);
  };

  const nextLevel = () => {
    if (currentLevelIdx < LEVELS.length - 1) {
      setCurrentLevelIdx(currentLevelIdx + 1);
      setIsWon(false);
    } else {
      setView('home');
    }
  };

  const canMove = (fromIndex: number, toIndex: number): boolean => {
    const fromTube = tubes[fromIndex];
    const toTube = tubes[toIndex];
    if (!fromTube || !toTube || fromTube.length === 0 || toTube.length >= TUBE_CAPACITY) return false;
    const ballToMove = fromTube[fromTube.length - 1];
    if (toTube.length === 0) return true;
    return ballToMove.color === toTube[toTube.length - 1].color;
  };

  const findHint = () => {
    if (isWon) return;
    for (let i = 0; i < tubes.length; i++) {
      for (let j = 0; j < tubes.length; j++) {
        if (i !== j && canMove(i, j)) {
          // Optimization: don't suggest moving a ball that is already in its final position
          if (tubes[j].length === 0 && tubes[i].every(b => b.color === tubes[i][0].color)) continue;
          setHint({ from: i, to: j });
          return;
        }
      }
    }
  };

  const handleTubeClick = (index: number) => {
    if (isWon) return;
    if (selectedTubeIndex === null) {
      if (tubes[index].length > 0) setSelectedTubeIndex(index);
    } else {
      if (selectedTubeIndex === index) setSelectedTubeIndex(null);
      else moveBall(selectedTubeIndex, index);
    }
  };

  const unlockedSet = useMemo(() => new Set([0, ...purchasedLevels, ...completedLevels.map(idx => idx + 1)]), [purchasedLevels, completedLevels]);
  const isLevelUnlocked = (idx: number) => unlockedSet.has(idx);

  const unlockLevelWithCoins = (idx: number) => {
    if (coins >= 200) {
      setCoins(prev => prev - 200);
      setPurchasedLevels(prev => [...prev, idx]);
      // Navigate to game immediately
      setCurrentLevelIdx(idx);
      setView('game');
    } else {
      alert("Not enough coins! You need 200 coins to unlock.");
    }
  };

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center p-6 text-white font-sans overflow-hidden">
        {/* Ad Placeholder */}
        <div className="w-full max-w-lg h-16 bg-slate-800/30 border border-white/5 rounded-2xl flex items-center justify-center text-[10px] text-white/20 font-bold mb-8 uppercase tracking-widest">
          Advertisement
        </div>

        <div className="absolute top-6 left-6 flex items-center gap-2">
          {!user ? (
            <button onClick={login} className="flex items-center gap-2 bg-blue-600/10 border border-blue-600/20 px-4 py-2 rounded-2xl hover:bg-blue-600/20 transition-colors text-xs font-bold">
              <Undo2 size={14} className="rotate-180" /> SYNC PROGRESS
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl text-xs font-bold text-emerald-400">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              CLOUD SYNC ACTIVE
            </div>
          )}
        </div>

        <div className="absolute top-6 right-6 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-4 py-2 rounded-2xl">
          <Coins size={16} className="text-yellow-500" />
          <span className="font-black text-yellow-500">{coins}</span>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-12 my-auto">
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent drop-shadow-2xl">
              BALL SORT
            </h1>
            <p className="text-blue-200/40 font-bold tracking-[0.3em] text-sm md:text-base uppercase underline decoration-blue-500/20 underline-offset-8 decoration-4">Ultimate Challenge</p>
          </div>
          
          <div className="flex justify-center gap-2 md:gap-4">
             {Object.values(COLORS).slice(0, 5).map((color, i) => (
                <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1 }} className="w-12 h-12 md:w-16 md:h-16 rounded-full shadow-lg relative"
                  style={{ backgroundColor: color, boxShadow: `0 0 25px ${color}44 inset, 0 10px 20px rgba(0,0,0,0.4)` }}>
                  <div className="absolute top-2 left-3 w-4 h-3 bg-white/50 rounded-full blur-[1px] rotate-[-20deg]" />
                  <div className="absolute bottom-2 right-3 w-2 h-2 bg-black/10 rounded-full blur-[1px]" />
                </motion.div>
             ))}
          </div>

          <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
            <button onClick={handlePlayNow}
              className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-3xl flex items-center justify-center gap-3 text-xl font-black transition-all shadow-xl hover:translate-y-[-4px] active:scale-95 group">
              <Play className="fill-current w-6 h-6" />
              PLAY NOW
            </button>
            
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => { setIsDailyChallenge(true); setView('game'); }}
                className="py-4 bg-purple-600 hover:bg-purple-500 rounded-2xl flex flex-col items-center justify-center gap-1 text-[10px] font-black transition-all shadow-xl active:scale-95 relative overflow-hidden group">
                <div className="absolute top-0 right-0 bg-yellow-400 text-black text-[6px] px-1 py-0.5 font-black uppercase rotate-12 translate-x-1">BONUS</div>
                <Lightbulb className="w-4 h-4" />
                DAILY
              </button>
              <button onClick={startEndless}
                className="py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl flex flex-col items-center justify-center gap-1 text-[10px] font-black transition-all shadow-xl active:scale-95 text-white">
                <ChevronRight className="w-4 h-4 rotate-[-90deg]" />
                ENDLESS
              </button>
              <button onClick={() => setView('levels')}
                className="py-4 bg-slate-800/50 hover:bg-slate-700/50 rounded-2xl flex flex-col items-center justify-center gap-1 text-[10px] font-black transition-all border border-white/5 active:scale-95 text-slate-300">
                <Trophy className="w-4 h-4 text-yellow-500" />
                LEVELS
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (view === 'levels') {
    return (
      <div className="min-h-screen bg-[#1a1a2e] text-white p-6 md:p-12 overflow-y-auto">
        <div className="max-w-5xl mx-auto mb-8">
          <div className="w-full h-16 bg-slate-800/30 border border-white/5 rounded-2xl flex items-center justify-center text-[10px] text-white/20 font-bold uppercase tracking-widest">
            Advertisement
          </div>
        </div>

        <header className="max-w-5xl mx-auto flex items-center justify-between mb-12">
          <button onClick={() => setView('home')} className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors">
            <Undo2 size={24} />
          </button>
          <h2 className="text-3xl font-black text-center flex-1 tracking-tighter uppercase italic">Mission Central</h2>
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-4 py-2 rounded-2xl">
            <Coins size={16} className="text-yellow-500" />
            <span className="font-black text-yellow-500">{coins}</span>
          </div>
        </header>
        
        <div className="max-w-5xl mx-auto grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-3 md:gap-4 mb-20">
          {LEVELS.map((level, idx) => {
            const isUnlocked = isLevelUnlocked(idx);
            const isCompleted = completedLevels.includes(idx);
            const canAfford = coins >= 200;
            
            return (
              <button key={level.id}
                onClick={() => { 
                  if (isUnlocked) {
                    setCurrentLevelIdx(idx); 
                    setView('game'); 
                  } else if (canAfford) {
                    setShowUnlockModal(idx);
                  }
                }}
                className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border-2 relative overflow-hidden transition-all
                  ${currentLevelIdx === idx && isUnlocked ? 'border-blue-500 bg-blue-500/20 shadow-lg scale-105 z-10' : 'border-white/5 bg-white/5 hover:bg-white/10 active:scale-95'}
                  ${!isUnlocked ? 'opacity-90 bg-slate-900 border-red-900/40 shadow-inner' : 'opacity-100'}
                  ${!isUnlocked && !canAfford ? 'grayscale opacity-40' : ''}
                `}
              >
                {!isUnlocked ? (
                   <div className="flex flex-col items-center gap-1">
                     <Lock size={16} className="text-red-500/60" />
                     <div className="flex items-center gap-0.5 text-[8px] font-black text-yellow-500/80">
                       <Coins size={8} /> 200
                     </div>
                   </div>
                ) : (
                  <>
                    <span className="text-lg md:text-xl font-black italic">{level.id}</span>
                    {isCompleted && (
                      <div className="absolute top-1 right-1">
                        <Trophy size={12} className="text-emerald-400" />
                      </div>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white font-sans p-4 md:p-8 flex flex-col animate-in fade-in duration-500 overflow-hidden">
      <div className="max-w-4xl mx-auto w-full mb-6">
        <div className="w-full h-12 bg-slate-800/30 border border-white/5 rounded-xl flex items-center justify-center text-[10px] text-white/20 font-bold uppercase tracking-widest">
          Advertisement
        </div>
      </div>

      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between mb-8">
        <div className="flex flex-col gap-1">
          <button onClick={() => { setView('levels'); setIsDailyChallenge(false); setIsEndlessMode(false); }} className="text-[10px] font-bold text-blue-400/60 hover:text-blue-400 flex items-center gap-1 uppercase tracking-widest mb-1 transition-colors">
            <Undo2 size={10} /> BACK TO LEVELS
          </button>
          <div className="flex items-baseline gap-3">
             <h2 className={`text-3xl font-black italic ${isDailyChallenge ? 'bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent' : isEndlessMode ? 'bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent' : 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent'}`}>
              {isDailyChallenge ? 'DAILY CHALLENGE' : isEndlessMode ? 'ENDLESS MODE' : `LEVEL ${currentLevel.id}`}
            </h2>
            {!isDailyChallenge && !isEndlessMode && <span className="text-[10px] text-white/20 font-mono">/ 200</span>}
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded-xl mr-2">
            <Coins size={14} className="text-yellow-500" />
            <span className="font-black text-yellow-500 text-sm">{coins}</span>
          </div>
          <button onClick={restart} className="p-3 bg-slate-800/80 hover:bg-slate-700/80 rounded-xl transition-colors border border-white/5 active:scale-95">
            <RotateCcw size={20} className="text-blue-400" />
          </button>
          <button onClick={() => setIsMuted(!isMuted)} className="p-3 bg-slate-800/80 hover:bg-slate-700/80 rounded-xl transition-colors border border-white/5 active:scale-95">
            {isMuted ? <VolumeX size={20} className="text-slate-400" /> : <Volume2 size={20} className="text-blue-400" />}
          </button>
        </div>
      </header>

      {/* Game Board */}
      <div className="flex-1 max-w-5xl mx-auto w-full flex flex-col items-center justify-center relative overflow-y-auto overflow-x-hidden p-4">
        <div className="flex flex-wrap justify-center gap-4 md:gap-8 p-6 bg-black/40 rounded-[30px] border border-white/10 shadow-2xl w-full">
          {tubes.map((tube, idx) => (
            <TubeComponent 
              key={idx}
              index={idx}
              tube={tube}
              isSelected={selectedTubeIndex === idx}
              onSelect={handleTubeClick}
              canDrop={selectedTubeIndex !== null && selectedTubeIndex !== idx && canMove(selectedTubeIndex, idx)}
            />
          ))}
        </div>
      </div>

      {/* Footer Controls */}
      <footer className="max-w-4xl mx-auto w-full flex items-center justify-center gap-12 mt-8 mb-6">
        <button onClick={undo} disabled={history.length === 0 || isWon} className="flex flex-col items-center gap-2 group disabled:opacity-10">
          <div className="p-4 bg-slate-800/80 rounded-2xl border border-white/5 group-active:scale-95 transition-transform"><Undo2 size={24} /></div>
          <span className="text-[10px] font-bold text-white/40 tracking-wider">UNDO</span>
        </button>
        <button onClick={findHint} disabled={isWon} className="flex flex-col items-center gap-2 group disabled:opacity-10">
          <div className="p-4 bg-slate-800/80 rounded-2xl border border-white/5 group-active:scale-95 transition-transform"><Lightbulb size={24} className="text-yellow-400" /></div>
          <span className="text-[10px] font-bold text-yellow-400 tracking-wider">HINT</span>
        </button>
        <button onClick={restart} className="flex flex-col items-center gap-2 group">
          <div className="p-4 bg-slate-800/80 rounded-2xl border border-white/5 group-active:scale-95 transition-transform"><RotateCcw size={24} /></div>
          <span className="text-[10px] font-bold text-white/40 tracking-wider">RESTART</span>
        </button>
      </footer>

      <AnimatePresence>
        {showUnlockModal !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-slate-900 border border-white/10 p-8 rounded-[32px] text-center max-w-sm w-full space-y-6 shadow-2xl">
              <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto">
                <Lock size={40} className="text-yellow-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black italic">UNLOCK LEVEL {LEVELS[showUnlockModal].id}?</h3>
                <p className="text-slate-400 text-sm">This mission requires 200 coins to access.</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-yellow-500 font-black text-2xl py-2">
                <Coins size={24} /> 200
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowUnlockModal(null)} className="py-4 bg-slate-800 rounded-2xl font-bold text-slate-400 hover:bg-slate-700 transition-colors">CANCEL</button>
                <button onClick={() => { unlockLevelWithCoins(showUnlockModal); setShowUnlockModal(null); }} className="py-4 bg-yellow-600 rounded-2xl font-black text-white hover:bg-yellow-500 transition-colors shadow-lg shadow-yellow-600/20">UNLOCK</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isWon && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-slate-900 border border-white/10 p-10 rounded-[40px] text-center max-w-sm w-full space-y-8 shadow-2xl">
              <Trophy size={64} className="text-yellow-500 mx-auto" />
              <div className="space-y-2">
                <h3 className="text-4xl font-black bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">WINNER!</h3>
                <div className="flex items-center justify-center gap-2 text-yellow-500 font-black text-xl bg-yellow-500/10 py-2 px-4 rounded-2xl w-fit mx-auto animate-bounce">
                  <Coins size={20} /> +{isDailyChallenge ? 200 : isEndlessMode ? 100 : 50}
                </div>
                <p className="text-slate-400 text-sm">{isDailyChallenge ? 'Daily Challenge completed!' : isEndlessMode ? 'Endless Level cleared!' : `Level ${currentLevel.id} cleared.`}</p>
              </div>
              <div className="space-y-3">
                {isDailyChallenge ? (
                  <button onClick={() => { setView('home'); setIsDailyChallenge(false); }} className="w-full py-5 bg-purple-600 rounded-3xl font-black flex items-center justify-center gap-2 text-xl shadow-lg hover:bg-purple-500 transition-colors">GO HOME <ChevronRight /></button>
                ) : isEndlessMode ? (
                  <button onClick={startEndless} className="w-full py-5 bg-emerald-600 rounded-3xl font-black flex items-center justify-center gap-2 text-xl shadow-lg hover:bg-emerald-500 transition-colors">KEEP GOING <ChevronRight /></button>
                ) : (
                  <button onClick={nextLevel} className="w-full py-5 bg-blue-600 rounded-3xl font-black flex items-center justify-center gap-2 text-xl shadow-lg hover:bg-blue-500 transition-colors">NEXT MISSION <ChevronRight /></button>
                )}
                <button onClick={() => { setView('levels'); setIsDailyChallenge(false); setIsEndlessMode(false); }} className="w-full py-4 text-white/40 font-bold hover:text-white transition-colors">Level Selection</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
