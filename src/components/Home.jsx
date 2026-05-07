import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import GlobalHeader from './Common/GlobalHeader';
import { fmtCurrency } from '../utils/calculations';

function ProgressRing({ pct, size = 100, stroke = 9 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible', display: 'block' }}>
      <g transform={`rotate(-90 ${size/2} ${size/2})`}>
        <circle cx={size/2} cy={size/2} r={r} stroke="rgba(0,0,0,0.07)" strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--ar-accent)" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(.2,.7,.2,1)' }} />
      </g>
      <text x={size/2} y={size/2} textAnchor="middle" dy="0.36em"
        style={{ fontSize: 16, fontWeight: 700, fill: 'var(--ar-fg)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</text>
    </svg>
  );
}

function StatItem({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--ar-muted)', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
      <div className="ar-num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ar-fg)' }}>{value}</div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { scenarios, targetScenario, targetId, userName, setUserName, user } = useApp();
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  function commitName() {
    setUserName(draftName.trim() || 'Emma');
    setEditingName(false);
  }
  const hasScenarios = scenarios.length > 0;

  const t = targetScenario;
  const targetPrice = t?.step1?.selectedPrice || null;
  const targetPITI = t?.step2?.piti || null;
  const targetDown = t?.step1?.downPct || 20;
  const targetRate = t?.step2?.mortgageRate || null;
  const targetReadyIn = t?.step1?.buyAtMonth ?? null;
  const targetContrib = t?.step1?.monthlyContrib || null;

  // Build dynamic subtitle from target scenario
  let subtitle;
  if (!t) {
    subtitle = 'Start by modeling a purchase to project your savings and affordability.';
  } else if (targetReadyIn != null && targetPrice && targetContrib) {
    subtitle = <>You're <strong>{targetReadyIn} months</strong> from buying around <strong>{fmtCurrency(targetPrice)}</strong> — if you keep saving <strong>{fmtCurrency(targetContrib)}</strong> a month.</>;
  } else if (targetReadyIn != null && targetPrice) {
    subtitle = <>You're <strong>{targetReadyIn} months</strong> from buying around <strong>{fmtCurrency(targetPrice)}</strong>.</>;
  } else if (targetPrice && targetContrib) {
    subtitle = <>Targeting <strong>{fmtCurrency(targetPrice)}</strong>, saving <strong>{fmtCurrency(targetContrib)}</strong> a month.</>;
  } else if (targetPrice) {
    subtitle = <>Targeting <strong>{fmtCurrency(targetPrice)}</strong>.</>;
  } else {
    subtitle = `${scenarios.length} scenario${scenarios.length !== 1 ? 's' : ''} saved.`;
  }

  // Simple progress estimate: current savings / down payment needed
  let progressPct = 0;
  const savedAmount = t?.step1?.initialSavings || 0;
  const dpNeeded = (targetPrice || 0) * (targetDown / 100);
  if (t) {
    progressPct = dpNeeded > 0 ? Math.min(100, Math.round((savedAmount / dpNeeded) * 100)) : 0;
  }

  return (
    <>
      <GlobalHeader />
      <div className="ar-scroll">
        <div className="ar-container">

          {/* Greeting */}
          <div className="ar-chip" style={{ marginBottom: 16 }}>
            Personal · {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          <h1 className="ar-display ar-home-title" style={{ fontSize: 60, lineHeight: 1.05, margin: '0 0 12px', fontWeight: 400 }}>
            {user ? (
              <>
                Welcome back,{' '}
                {editingName ? (
                  <input
                    ref={nameInputRef}
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
                    style={{
                      display: 'inline', fontSize: 'inherit', fontFamily: 'inherit',
                      fontWeight: 'inherit', letterSpacing: 'inherit',
                      background: 'transparent', border: 'none', outline: 'none',
                      borderBottom: '2px solid var(--ar-accent)', color: 'inherit',
                      padding: 0, width: `${Math.max(3, draftName.length)}ch`,
                    }}
                  />
                ) : (
                  <span
                    onClick={() => { setDraftName(userName); setEditingName(true); }}
                    title="Click to edit name"
                    style={{ cursor: 'text', borderBottom: '2px dashed transparent', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderBottomColor = 'var(--ar-muted)'}
                    onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
                  >{userName}</span>
                )}.
              </>
            ) : 'Welcome.'}
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ar-muted)', maxWidth: 560, margin: '0 0 36px', lineHeight: 1.6 }}>
            {subtitle}
          </p>

          {/* Current target card */}
          {t && targetPrice ? (
            <div className="ar-card ar-home-target" style={{ marginBottom: 28 }}>
              <div className="ar-home-target-body">
                <div className="ar-label" style={{ marginBottom: 8 }}>Current target</div>
                <div className="ar-display ar-num ar-home-target-price">
                  {fmtCurrency(targetPrice)}
                </div>
                <div className="ar-home-target-name">{t.name}</div>
                <div className="ar-home-target-stats">
                  {targetPITI && <StatItem label="PITI" value={fmtCurrency(targetPITI)} />}
                  <StatItem label="DOWN" value={`${targetDown}%`} />
                  {targetReadyIn != null && <StatItem label="READY IN" value={`${targetReadyIn} mo`} />}
                  {targetRate && <StatItem label="RATE" value={`${targetRate}%`} />}
                </div>
              </div>
              <div className="ar-home-target-ring">
                <div className="ar-label" style={{ letterSpacing: '0.1em', marginBottom: 6 }}>DOWN PAYMENT</div>
                <ProgressRing pct={progressPct} />
                <div className="ar-num ar-home-target-saved">
                  {fmtCurrency(savedAmount)}
                </div>
                <div className="ar-home-target-needed">
                  of {fmtCurrency(dpNeeded)} needed
                </div>
              </div>
            </div>
          ) : hasScenarios ? (
            <div className="ar-card" style={{ marginBottom: 28, padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div className="ar-label" style={{ marginBottom: 6 }}>No target selected</div>
                <div style={{ fontSize: 15, color: 'var(--ar-muted)' }}>
                  You have {scenarios.length} saved scenario{scenarios.length !== 1 ? 's' : ''}. Set one as your target to see it here.
                </div>
              </div>
              <button className="ar-btn ar-btn-accent" onClick={() => navigate('/scenarios')}>
                Set a target →
              </button>
            </div>
          ) : null}

          {/* Quick action tiles */}
          <div className="ar-grid-4">
            {[
              { num: '01', title: 'Model a purchase', sub: 'Build a savings plan and explore affordability', path: '/calculator', always: true },
              { num: '02', title: 'Compare scenarios', sub: 'Review saved plans side by side', path: '/compare', always: false },
              { num: '03', title: 'Target summary', sub: 'Track your selected target home', path: targetId ? `/scenarios?open=${targetId}` : '/scenarios', always: false },
              { num: '04', title: 'Track progress', sub: 'Log actual savings against target', path: '/progress', always: true },
            ].map(tile => {
              const locked = !tile.always && !hasScenarios;
              return (
                <div
                  key={tile.num}
                  className="ar-tile"
                  onClick={() => !locked && navigate(tile.path)}
                  style={{ opacity: locked ? 0.45 : 1, cursor: locked ? 'not-allowed' : 'pointer' }}
                >
                  <div className="ar-label" style={{ color: 'var(--ar-muted)' }}>{tile.num}</div>
                  <div className="ar-display" style={{ fontSize: 22, margin: '10px 0 8px' }}>{tile.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--ar-muted)', flex: 1, marginBottom: 20, lineHeight: 1.5 }}>{tile.sub}</div>
                  {locked && (
                    <div style={{ fontSize: 11, color: 'var(--ar-muted)', marginBottom: 8 }}>Save a scenario first</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ar-accent)', fontSize: 13, fontWeight: 500 }}>
                    Open →
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </>
  );
}
