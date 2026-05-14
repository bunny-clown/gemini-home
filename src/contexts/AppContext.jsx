import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { generateId } from '../utils/calculations';
import { auth, isFirebaseConfigured } from '../utils/firebase';
import { loadUserData, saveUserData } from '../utils/firestore';

const AppContext = createContext(null);

const STORAGE_KEY = 'hpm_scenarios_v1';
const PROGRESS_KEY = 'hpm_progress_v1';

function loadFromStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveToStorage(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* noop */ }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [showAuth, setShowAuth] = useState(false);
  const [scenarios, setScenarios] = useState(() => loadFromStorage(STORAGE_KEY, []));
  const [targetId, setTargetId] = useState(() => loadFromStorage('hpm_target', null));
  const [progress, setProgress] = useState(() => loadFromStorage(PROGRESS_KEY, {}));
  const [compareIds, setCompareIds] = useState([]);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [navGuard, setNavGuard] = useState(null);
  const [userName, setUserName] = useState(() => loadFromStorage('hpm_username', 'Emma'));

  // localStorage — always kept in sync as offline fallback
  useEffect(() => saveToStorage(STORAGE_KEY, scenarios), [scenarios]);
  useEffect(() => saveToStorage('hpm_target', targetId), [targetId]);
  useEffect(() => saveToStorage(PROGRESS_KEY, progress), [progress]);
  useEffect(() => saveToStorage('hpm_username', userName), [userName]);

  // Firebase auth state listener — single source of truth for sign-in/out
  const lastUidRef = useRef(null);
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const firstName = fbUser.displayName?.split(' ')[0] || fbUser.email?.split('@')[0] || 'Friend';
        // Only load from Firestore when the user actually changes (sign-in / switch account).
        // Token refreshes re-fire this callback with the same uid — skip the load to avoid
        // overwriting in-memory changes that haven't been synced to Firestore yet.
        if (lastUidRef.current !== fbUser.uid) {
          lastUidRef.current = fbUser.uid;
          const cloudData = await loadUserData(fbUser.uid);
          if (cloudData) {
            setScenarios(cloudData.scenarios ?? []);
            setProgress(cloudData.progress ?? {});
            setTargetId(cloudData.targetId ?? null);
            setUserName(cloudData.userName || firstName);
          } else {
            setUserName(prev => prev === 'Emma' ? firstName : prev);
          }
        }
        setUser(fbUser);
      } else {
        lastUidRef.current = null;
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Debounced Firestore sync whenever cloud-relevant state changes
  const syncTimerRef = useRef(null);
  useEffect(() => {
    if (!user || user.isDemo || !isFirebaseConfigured) return;
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      saveUserData(user.uid, { scenarios, progress, targetId, userName });
    }, 2000);
    return () => clearTimeout(syncTimerRef.current);
  }, [user, scenarios, progress, targetId, userName]);

  const signOut = useCallback(async () => {
    if (user?.isDemo) {
      setUser(null);
      return;
    }
    if (isFirebaseConfigured && auth) {
      await firebaseSignOut(auth);
      // onAuthStateChanged handles setUser(null)
    } else {
      setUser(null);
    }
  }, [user]);

  const signInDemo = useCallback((displayName = 'Friend') => {
    const firstName = displayName.trim().split(' ')[0] || 'Friend';
    setUser({ uid: 'demo', email: 'demo@example.com', displayName: firstName, isDemo: true });
    setUserName(firstName);
  }, []);

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
    if (targetId === id) setTargetId(null);
    setCompareIds(prev => prev.filter(x => x !== id));
  }, [targetId]);

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
      const next = { ...prev, [scenarioId]: { ...(prev[scenarioId] || {}) } };
      if (amount == null) {
        delete next[scenarioId][monthIdx];
      } else {
        next[scenarioId][monthIdx] = amount;
      }
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
      user, signOut, signInDemo,
      authLoading,
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
    }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(AppContext);
