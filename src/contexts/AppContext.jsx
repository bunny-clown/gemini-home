import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { generateId } from '../utils/calculations';

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
  const [showAuth, setShowAuth] = useState(false);
  const [scenarios, setScenarios] = useState(() => loadFromStorage(STORAGE_KEY, []));
  const [targetId, setTargetId] = useState(() => loadFromStorage('hpm_target', null));
  const [progress, setProgress] = useState(() => loadFromStorage(PROGRESS_KEY, {}));
  const [compareIds, setCompareIds] = useState([]);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [navGuard, setNavGuard] = useState(null); // fn(proceed) | null
  const [userName, setUserName] = useState(() => loadFromStorage('hpm_username', 'Emma'));

  useEffect(() => saveToStorage(STORAGE_KEY, scenarios), [scenarios]);
  useEffect(() => saveToStorage('hpm_target', targetId), [targetId]);
  useEffect(() => saveToStorage(PROGRESS_KEY, progress), [progress]);
  useEffect(() => saveToStorage('hpm_username', userName), [userName]);

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
    }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(AppContext);
