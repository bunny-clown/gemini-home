import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { generateId } from '../utils/calculations';
import { db } from '../utils/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const AppContext = createContext(null);

/* ─── Firestore helpers ────────────────────────────────────────────────── */
function getUserDataRef(uid) {
  return doc(db, 'users', uid);
}

function isRealFirebaseUser(u) {
  return u?.uid && !u.isDemo && db;
}

/* ─── Component ────────────────────────────────────────────────────────── */
export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [scenarios, setScenarios] = useState([]);
  const [targetId, setTargetId] = useState(null);
  const [progress, setProgress] = useState({});
  const [userName, setUserName] = useState('User');

  const [compareIds, setCompareIds] = useState([]);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [navGuard, setNavGuard] = useState(null);

  const unsubscribeRef = useRef(null);
  const pendingRef = useRef(false);

  /* ── Load from Firestore when real user changes ───────────────────── */
  useEffect(() => {
    if (!isRealFirebaseUser(user)) {
      setIsReady(true);
      return;
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    const ref = getUserDataRef(user.uid);
    unsubscribeRef.current = onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (!pendingRef.current) {
            setScenarios(data.scenarios ?? []);
            setTargetId(data.targetId ?? null);
            setProgress(data.progress ?? {});
            setUserName(data.userName ?? 'User');
          }
        }
        setIsReady(true);
      },
      (err) => {
        console.error('Firestore read error:', err);
        setIsReady(true);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user?.uid, user?.isDemo]);

  /* ── Write to Firestore when data changes ───────────────────────────── */
  useEffect(() => {
    if (!isRealFirebaseUser(user) || !isReady) return;

    const ref = getUserDataRef(user.uid);
    pendingRef.current = true;
    setDoc(ref, { scenarios, targetId, progress, userName }, { merge: true })
      .then(() => { pendingRef.current = false; })
      .catch((err) => {
        console.error('Firestore write error:', err);
        pendingRef.current = false;
      });
  }, [user?.uid, user?.isDemo, isReady, scenarios, targetId, progress, userName]);

  /* ── CRUD operations ──────────────────────────────────────────────── */
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

  return (
    <AppContext.Provider value={{
      user, setUser,
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
      isReady,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(AppContext);
