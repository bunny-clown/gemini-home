import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { generateId } from '../utils/calculations';
import { auth, db } from '../utils/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const AppContext = createContext(null);

function getUserDataRef(uid) {
  return doc(db, 'users', uid);
}

export function AppProvider({ children }) {
  const [showAuth, setShowAuth] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [scenarios, setScenarios] = useState([]);
  const [targetId, setTargetId] = useState(null);
  const [progress, setProgress] = useState({});
  const [userName, setUserName] = useState('User');

  const [compareIds, setCompareIds] = useState([]);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [navGuard, setNavGuard] = useState(null);

  // Track the REAL Firebase auth user (not the manually-set one)
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const unsubscribeRef = useRef(null);
  const pendingRef = useRef(false);

  /* ── Listen to Firebase auth state ─────────────────────────────────── */
  useEffect(() => {
    console.log('[AppContext] Starting Firebase auth listener...');
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log('[AppContext] Firebase auth state:', u ? { uid: u.uid, email: u.email } : 'signed out');
      setFirebaseUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  /* ── Load from Firestore when user changes ───────────────────────────── */
  useEffect(() => {
    if (authLoading) return;

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!firebaseUser?.uid) {
      console.log('[AppContext] No Firebase user — clearing data');
      setScenarios([]);
      setTargetId(null);
      setProgress({});
      setUserName('User');
      setIsReady(true);
      return;
    }

    const ref = getUserDataRef(firebaseUser.uid);
    console.log('[AppContext] Starting Firestore listener for uid:', firebaseUser.uid);

    unsubscribeRef.current = onSnapshot(
      ref,
      (snapshot) => {
        console.log('[AppContext] Firestore snapshot exists:', snapshot.exists());
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log('[AppContext] Firestore data:', JSON.stringify({ keys: Object.keys(data), scenarioCount: data.scenarios?.length }));
          if (!pendingRef.current) {
            setScenarios(data.scenarios ?? []);
            setTargetId(data.targetId ?? null);
            setProgress(data.progress ?? {});
            if (data.userName) setUserName(data.userName);
          }
        } else {
          console.log('[AppContext] No existing doc — first time user');
        }
        setIsReady(true);
      },
      (err) => {
        console.error('[AppContext] Firestore read error:', err.code, err.message);
        setIsReady(true);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [firebaseUser?.uid, authLoading]);

  /* ── Write to Firestore when data changes ───────────────────────────── */
  useEffect(() => {
    console.log('[AppContext] Write check — firebaseUser?', !!firebaseUser, 'isReady?', isReady, 'scenarios length:', scenarios.length);
    if (!firebaseUser?.uid || !isReady) return;

    const ref = getUserDataRef(firebaseUser.uid);
    console.log('[AppContext] Writing to Firestore for uid:', firebaseUser.uid);
    pendingRef.current = true;
    setDoc(ref, { scenarios, targetId, progress, userName }, { merge: true })
      .then(() => {
        console.log('[AppContext] Firestore write SUCCESS');
        pendingRef.current = false;
      })
      .catch((err) => {
        console.error('[AppContext] Firestore write FAILED:', err.code, err.message);
        pendingRef.current = false;
      });
  }, [firebaseUser?.uid, isReady, scenarios, targetId, progress, userName]);

  /* ── CRUD operations ────────────────────────────────────────────────── */
  const saveScenario = useCallback((data) => {
    const id = data.id || generateId();
    const ts = Date.now();
    setScenarios(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...data, id, updatedAt: ts };
        return next;
      }
      return [{ ...data, id, createdAt: ts, updatedAt: ts }, ...prev];
    });
    return id;
  }, []);

  const deleteScenario = useCallback((id) => {
    setScenarios(prev => prev.filter(s => s.id !== id));
    setTargetId(prev => prev === id ? null : prev);
    setCompareIds(prev => prev.filter(x => x !== id));
  }, []);

  const starScenario = useCallback((id) => {
    setTargetId(prev => prev === id ? null : id);
  }, []);

  const toggleCompare = useCallback((id) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);

  const updateProgress = useCallback((scenarioId, monthIdx, amount) => {
    setProgress(prev => {
      const next = { ...prev };
      if (!next[scenarioId]) next[scenarioId] = {};
      next[scenarioId][monthIdx] = amount;
      return next;
    });
  }, []);

  const updateNote = useCallback((id, note) => {
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, note } : s));
  }, []);

  const reorderScenarios = useCallback((fromIdx, toIdx) => {
    setScenarios(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const targetScenario = scenarios.find(s => s.id === targetId) || null;

  // Provide a setUser that does nothing — auth is handled by Firebase state listener
  const setUser = useCallback(() => {}, []);

  return (
    <AppContext.Provider value={{
      user: firebaseUser,
      setUser,
      showAuth, setShowAuth,
      scenarios, saveScenario, deleteScenario, starScenario,
      targetId, targetScenario,
      compareIds, toggleCompare, setCompareIds,
      progress, updateProgress,
      currentScenario, setCurrentScenario,
      updateNote,
      reorderScenarios,
      userName, setUserName,
      navGuard, setNavGuard,
      isReady: isReady && !authLoading,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(AppContext);
