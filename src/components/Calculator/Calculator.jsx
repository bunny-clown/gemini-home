import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalHeader from '../Common/GlobalHeader';
import Step1 from './Step1';
import Step2 from './Step2';
import Step3 from './Step3';
import { useApp } from '../../contexts/AppContext';

const STEPS = [
  { id: 1, label: 'Savings' },
  { id: 2, label: 'Payment' },
  { id: 3, label: 'Refinance' },
];

export default function Calculator({ editId }) {
  const navigate = useNavigate();
  const { saveScenario, scenarios, setNavGuard } = useApp();

  const existing = editId ? scenarios.find(s => s.id === editId) : null;
  const [step, setStep] = useState(1);
  const [name, setName] = useState(existing?.name || '');
  const [step1, setStep1] = useState(existing?.step1 || {});
  const [step2, setStep2] = useState(existing?.step2 || {});
  const [step3, setStep3] = useState(existing?.step3 || {});
  const [saved, setSaved] = useState(!!editId);
  const [savedId, setSavedId] = useState(editId || null);
  const [savedToast, setSavedToast] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [showSavedModal, setShowSavedModal] = useState(false);

  const isDirty = !saved;
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const pendingProceed = useRef(null);

  // Register / clear the nav guard whenever dirty state changes
  useEffect(() => {
    if (isDirty) {
      setNavGuard(() => (proceed) => {
        pendingProceed.current = proceed;
        setShowLeaveModal(true);
      });
    } else {
      setNavGuard(null);
    }
    return () => setNavGuard(null);
  }, [isDirty, setNavGuard]);

  const doSave = useCallback((scenarioName) => {
    const finalName = scenarioName || 'Unnamed Scenario';
    setName(finalName);
    const id = saveScenario({ id: savedId, name: finalName, step1, step2, step3 });
    setSavedId(id);
    setSaved(true);
    setShowNameModal(false);
    setSavedToast(true);
    setShowSavedModal(true);
    setTimeout(() => setSavedToast(false), 2000);
  }, [savedId, step1, step2, step3, saveScenario]);

  const handleSave = useCallback(() => {
    if (name.trim()) {
      doSave(name.trim());
    } else {
      setDraftName('');
      setShowNameModal(true);
    }
  }, [name, doSave]);

  const updateStep = (setter, val) => { setter(val); setSaved(false); };

  return (
    <>
      <GlobalHeader />

      {/* Wizard step bar */}
      <div className="ar-wizard-bar" style={{
        borderBottom: '1px solid var(--ar-border)',
        background: 'var(--ar-bg)',
        padding: '16px 28px',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        {/* Step dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'none', border: 'none', font: 'inherit', padding: 0 }}
                onClick={() => setStep(s.id)}
              >
                <div className={`ar-step-dot ${s.id === step ? 'active' : s.id < step ? 'done' : ''}`}>
                  {s.id < step ? '✓' : s.id}
                </div>
                <span className="ar-step-label" style={{
                  fontWeight: s.id === step ? 600 : 400,
                  color: s.id === step ? 'var(--ar-fg)' : 'var(--ar-muted)',
                  fontSize: 14,
                }}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="ar-wizard-connector" style={{ width: 40, height: 1, background: 'var(--ar-border)' }} />
              )}
            </div>
          ))}
        </div>

        {/* Scenario name + save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setSaved(false); }}
            placeholder="Scenario name…"
            className="ar-input"
            style={{ width: 200, fontSize: 14 }}
          />
          <button
            className={`ar-btn ${isDirty ? 'ar-btn-accent' : 'ar-btn-ghost'}`}
            onClick={handleSave}
          >
            {isDirty ? 'Save' : '✓ Saved'}
          </button>
          {savedId && (
            <button
              className="ar-btn ar-btn-ghost ar-btn-sm"
              onClick={() => navigate('/scenarios')}
            >
              View all →
            </button>
          )}
        </div>
      </div>

      {/* Step content */}
      <div className="ar-scroll">
        <div className="ar-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {step === 1 && <Step1 data={step1} onChange={v => updateStep(setStep1, v)} scenarioId={savedId} />}
          {step === 2 && <Step2 data={step2} onChange={v => updateStep(setStep2, v)} step1={step1} />}
          {step === 3 && <Step3 data={step3} onChange={v => updateStep(setStep3, v)} step1={step1} step2={step2} />}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 20, borderTop: '1px solid var(--ar-border)' }}>
            <button
              className="ar-btn ar-btn-ghost"
              disabled={step === 1}
              onClick={() => setStep(s => s - 1)}
            >
              ← Back
            </button>
            {step < 3 ? (
              <>
                {step === 1 && (!step1.selectedPrice || !step1.selectedPurchaseMonth) && (
                  <span style={{ fontSize: 13, color: 'var(--ar-muted)', alignSelf: 'center' }}>
                    Select a home from the affordability map to continue
                  </span>
                )}
                <button
                  className="ar-btn ar-btn-accent"
                  onClick={() => setStep(s => s + 1)}
                  disabled={step === 1 && (!step1.selectedPrice || !step1.selectedPurchaseMonth)}
                >
                  Continue →
                </button>
              </>
            ) : (
              <button className="ar-btn ar-btn-accent" onClick={handleSave}>
                Save scenario →
              </button>
            )}
          </div>
        </div>
      </div>

      {savedToast && (
        <div className="ar-toast" style={{ gap: 12 }}>
          <div style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ar-accent)', flexShrink: 0 }} />
          <span>Saved &ldquo;{name}&rdquo;</span>
        </div>
      )}

      {/* Saved modal */}
      {showSavedModal && (
        <div
          className="ar-modal-bg"
          onClick={() => setShowSavedModal(false)}
        >
          <div
            className="ar-modal"
            style={{ maxWidth: 400, padding: 32 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="ar-label" style={{ marginBottom: 8 }}>Scenario saved</div>
            <h2 className="ar-display" style={{ fontSize: 26, fontWeight: 400, margin: '0 0 8px' }}>
              &ldquo;{name}&rdquo;
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ar-muted)', margin: '0 0 24px' }}>
              Your scenario has been saved. What would you like to do next?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="ar-btn ar-btn-accent"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => navigate('/scenarios')}
              >
                View all scenarios →
              </button>
              <button
                className="ar-btn ar-btn-ghost"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setShowSavedModal(false)}
              >
                Continue editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved changes leave modal */}
      {showLeaveModal && (
        <div className="ar-modal-bg">
          <div className="ar-modal" style={{ maxWidth: 400, padding: 32 }} onClick={e => e.stopPropagation()}>
            <div className="ar-label" style={{ marginBottom: 8 }}>Unsaved changes</div>
            <h2 className="ar-display" style={{ fontSize: 22, fontWeight: 400, margin: '0 0 10px' }}>
              Save before leaving?
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ar-muted)', margin: '0 0 24px' }}>
              You have unsaved changes. Would you like to save before navigating away?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="ar-btn ar-btn-accent"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  setShowLeaveModal(false);
                  handleSave();
                  pendingProceed.current?.();
                  pendingProceed.current = null;
                }}
              >
                Save and leave →
              </button>
              <button
                className="ar-btn ar-btn-ghost"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  setShowLeaveModal(false);
                  pendingProceed.current?.();
                  pendingProceed.current = null;
                }}
              >
                Leave without saving
              </button>
              <button
                className="ar-btn ar-btn-ghost"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  setShowLeaveModal(false);
                  pendingProceed.current = null;
                }}
              >
                Stay on page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Name modal */}
      {showNameModal && (
        <div
          className="ar-modal-bg"
          onClick={() => setShowNameModal(false)}
        >
          <div
            className="ar-modal"
            style={{ maxWidth: 420, padding: 32 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="ar-label" style={{ marginBottom: 8 }}>Save scenario</div>
            <h2 className="ar-display" style={{ fontSize: 26, fontWeight: 400, margin: '0 0 20px' }}>
              Give it a name
            </h2>
            <input
              className="ar-input"
              style={{ width: '100%', fontSize: 16, marginBottom: 20 }}
              placeholder="e.g. 500k at 20% down"
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doSave(draftName || 'Unnamed Scenario'); }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ar-btn ar-btn-ghost" onClick={() => setShowNameModal(false)}>Cancel</button>
              <button className="ar-btn ar-btn-accent" onClick={() => doSave(draftName || 'Unnamed Scenario')}>
                Save →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
