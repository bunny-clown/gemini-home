import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import Home from './components/Home';
import Calculator from './components/Calculator/Calculator';
import ScenariosGallery from './components/Scenarios/ScenariosGallery';
import ScenarioCompare from './components/Scenarios/ScenarioCompare';
import TrackProgress from './components/Progress/TrackProgress';
import AuthModal from './components/Auth/AuthModal';

function CalcRoute() {
  const [params] = useSearchParams();
  return <Calculator editId={params.get('edit')} />;
}

function AppRoutes() {
  const { showAuth } = useApp();
  return (
    <div className="aurora-app">
      {showAuth && <AuthModal />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/calculator" element={<CalcRoute />} />
        <Route path="/scenarios" element={<ScenariosGallery />} />
        <Route path="/compare" element={<ScenarioCompare />} />
        <Route path="/progress" element={<TrackProgress />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
