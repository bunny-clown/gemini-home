import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import GlobalHeader from '../Common/GlobalHeader';
import { fmtCurrency, calcPI, buildRefiSimulation, mortgageBalance, monthsBetween, fmtMonthLabel } from '../../utils/calculations';

function Row({ label, value, valueStyle }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span className="ar-label" style={{ color: 'var(--ar-muted, #888)' }}>{label}</span>
      <span className="ar-num" style={valueStyle}>{value}</span>
    </div>
  );
}

// ── Scenario card ───────────────────────────────────────────────────────────
function ScenarioCard({ scenario, isTarget, onSetTarget, onDelete, onOpenModal, onEdit, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const { progress } = useApp();
  const s1 = scenario.step1 || {};
  const s2 = scenario.step2 || {};
  const homePrice = s1.selectedPrice || 0;
  const downPct = s1.downPct || 20;
  const dp = homePrice * downPct / 100;
  const closingCosts = homePrice * 0.04;
  const leftover = (s1.selectedBalance || 0) - dp - closingCosts;
  const piti = s2.piti || 0;
  const purchaseDate = s1.selectedPurchaseMonth || '—';

  const leftoverColor = leftover >= 0 ? 'var(--ar-green, #22c55e)' : 'var(--ar-red, #ef4444)';

  const scenarioProgress = progress?.[scenario.id] || {};
  const enteredMonths = Object.keys(scenarioProgress).map(Number).filter(n => n >= 0).sort((a, b) => a - b);
  const latestIdx = enteredMonths.length > 0 ? enteredMonths[enteredMonths.length - 1] : -1;
  const trackedBalance = latestIdx >= 0 ? (scenarioProgress[latestIdx] || 0) : 0;
  const dpPct = dp > 0 ? Math.min(100, Math.round((trackedBalance / dp) * 100)) : null;
  const barColor = dpPct != null && dpPct >= 100 ? 'var(--ar-pos)' : 'var(--ar-warn)';

  return (
    <div
      className="ar-card"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{
        cursor: 'pointer', position: 'relative',
        opacity: isDragging ? 0.4 : 1,
        outline: isDragOver ? '2px dashed var(--ar-accent)' : isTarget ? '2px solid var(--ar-accent)' : 'none',
        outlineOffset: 0,
        transition: 'opacity 0.15s',
      }}
      onClick={() => onOpenModal(scenario.id)}
    >
      {/* Drag handle */}
      <div
        style={{ position: 'absolute', top: 14, left: 14, cursor: 'grab', color: 'var(--ar-muted)', fontSize: 16, lineHeight: 1, userSelect: 'none' }}
        onClick={e => e.stopPropagation()}
      >⠿</div>

      {isTarget && (
        <span className="ar-chip" style={{ position: 'absolute', top: 12, right: 12 }}>
          ◉ Target
        </span>
      )}

      <div className="ar-label" style={{ color: 'var(--ar-muted, #888)', marginBottom: 4, paddingLeft: 22 }}>
        {homePrice ? fmtCurrency(homePrice) : '—'}
      </div>

      <div className="ar-display" style={{ marginBottom: 16, fontSize: 22, paddingLeft: 22 }}>
        {scenario.name || 'Untitled scenario'}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Row label="Purchase date" value={purchaseDate} />
        <Row label="PITI" value={fmtCurrency(piti)} />
        <Row
          label="Leftover cash"
          value={fmtCurrency(leftover)}
          valueStyle={{ color: leftoverColor, fontWeight: 600 }}
        />
        {dpPct != null && (
          <div style={{ padding: '6px 0 2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span className="ar-label" style={{ color: 'var(--ar-muted, #888)' }}>Down payment saved</span>
              <span className="ar-num" style={{ fontSize: 12, fontWeight: 600, color: barColor }}>{dpPct}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--ar-border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${dpPct}%`, borderRadius: 3, background: barColor, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--ar-muted)', marginTop: 2 }}>
              dbg: id={scenario.id} progressKeys={Object.keys(progress||{}).join('|')}
            </div>
          </div>
        )}
      </div>

      <div
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          className="ar-btn ar-btn-ghost ar-btn-sm"
          onClick={() => onSetTarget(scenario.id)}
        >
          {isTarget ? '◉ Targeted' : 'Set as target'}
        </button>
        <button
          className="ar-btn ar-btn-ghost ar-btn-sm"
          onClick={() => onEdit(scenario.id)}
        >
          Edit
        </button>
        <button
          className="ar-btn ar-btn-ghost ar-btn-sm"
          style={{ marginLeft: 'auto', color: 'var(--ar-red, #ef4444)' }}
          onClick={() => onDelete(scenario.id)}
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Modal helpers ───────────────────────────────────────────────────────────
function ModalSection({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="ar-label" style={{ color: 'var(--ar-accent)', letterSpacing: '0.12em', fontSize: 11, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {children}
      </div>
    </div>
  );
}

function MR({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--ar-border)' }}>
      <span style={{ color: 'var(--ar-muted)' }}>{label}</span>
      <span className="ar-num" style={{ fontWeight: 500, color: color || 'var(--ar-fg)' }}>{value ?? '—'}</span>
    </div>
  );
}

function fmtRate(r) {
  if (r == null || isNaN(r)) return '—';
  if (r === 0) return '~0% (any rate works)';
  return `${Number(r).toFixed(2)}%`;
}

// ── Full scenario modal ─────────────────────────────────────────────────────
function ScenarioModal({ scenario, onClose, onSetTarget, isTarget, onEdit, updateNote }) {
  const [note, setNote] = useState(scenario?.note || '');
  const [tab, setTab] = useState('overview');

  const s1 = scenario.step1 || {};
  const s2 = scenario.step2 || {};
  const s3 = scenario.step3 || {};

  const homePrice = s1.selectedPrice || 0;
  const downPct = s1.downPct || 20;
  const loanAmount = homePrice * (1 - downPct / 100);
  const dp = homePrice * downPct / 100;
  const closingCosts = homePrice * 0.04;
  const leftover = (s1.selectedBalance || 0) - dp - closingCosts;
  const purchaseMonth = s1.selectedPurchaseMonth || s1.startMonth || '';

  const piti = s2.piti || 0;
  const rate = s2.mortgageRate || 0;
  const term = s2.loanTerm || 30;
  const grossIncome = s2.grossMonthlyIncome || 0;
  const otherExp = s2.otherMonthlyExpenses || 0;
  const monthlyReserves = s2.monthlyReserves || Math.max(0, grossIncome - otherExp - piti);

  const monthlyContrib = s1.monthlyContrib || 0;

  const refiDate = s3.refiDate || '';
  const customFunds = s3.customFunds || [];
  const monthsToRefi = monthsBetween(purchaseMonth, refiDate);
  const balAtRefi = rate && loanAmount ? mortgageBalance(loanAmount, rate, term, Math.max(0, monthsToRefi)) : 0;

  let sim = null;
  try {
    sim = buildRefiSimulation({
      purchasePrice: homePrice, loanAmount, purchaseRate: rate || 5.5, loanTerm: term,
      purchaseMonth, refiDateStr: refiDate, targetPayment: s3.targetPayment || 0,
      emergencyTarget: 0, renovTarget: 0, customFunds: s3.customFunds || [],
      refiRate: rate || 5.5, fundOrder: s3.fundOrder || [],
      monthlyFundContrib: monthlyReserves,
    });
  } catch { /* leave null */ }

  const prepayBalance = sim?.prepayFundBalance || 0;
  const newLoanBal = Math.max(0, balAtRefi - prepayBalance);
  const paymentAtExistingRate = rate && newLoanBal ? calcPI(newLoanBal, rate, term) : 0;
  const fundFillMonths = sim?.fundFillMonths || {};

  const handleNoteBlur = () => updateNote && updateNote(scenario.id, note);

  return (
    <div className="ar-modal-bg" onClick={onClose}>
      <div
        className="ar-modal"
        style={{ padding: 32, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--ar-border)' }}>
          <div className="ar-label" style={{ color: 'var(--ar-muted)', marginBottom: 6 }}>Scenario</div>
          <h2 className="ar-display" style={{ fontSize: 32, fontWeight: 400, margin: '0 0 16px', lineHeight: 1.1 }}>
            {scenario.name || 'Untitled scenario'}
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="ar-btn ar-btn-ghost ar-btn-sm" onClick={() => onEdit(scenario.id)}>View in wizard →</button>
            <button className="ar-btn ar-btn-ghost ar-btn-sm" style={{ marginLeft: 'auto' }} onClick={onClose}>Close</button>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="ar-modal-tabs">
          {[['overview','Overview'],['budget','Budget'],['refi','Refi'],['notes','Notes']].map(([key, label]) => (
            <button key={key} className={`ar-modal-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {/* Desktop: 2-column grid */}
        <div className="ar-modal-desktop" style={{ gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
          <div>
            <ModalSection title="SAVINGS PLAN">
              <MR label="Monthly saving" value={monthlyContrib ? fmtCurrency(monthlyContrib) : '—'} />
              <MR label="First available" value={fmtMonthLabel(purchaseMonth, 0)} />
            </ModalSection>
            <ModalSection title="PURCHASE">
              <MR label="Home price" value={homePrice ? fmtCurrency(homePrice) : '—'} />
              <MR label="Loan amount" value={loanAmount ? fmtCurrency(loanAmount) : '—'} />
              <MR label="Leftover cash" value={fmtCurrency(leftover)} color={leftover >= 0 ? 'var(--ar-pos)' : 'var(--ar-warn)'} />
            </ModalSection>
            <ModalSection title="MONTHLY PAYMENT">
              <MR label="PITI" value={piti ? fmtCurrency(piti) : '—'} />
              <MR label="Interest rate" value={rate ? `${rate.toFixed(2)}%` : '—'} />
              <MR label="Loan term" value={term ? `${term} yr` : '—'} />
            </ModalSection>
          </div>
          <div>
            <ModalSection title="MONTHLY BUDGET">
              <MR label="Gross income" value={grossIncome ? fmtCurrency(grossIncome) : '—'} />
              <MR label="Other expenses" value={fmtCurrency(otherExp)} />
              <MR label="Monthly reserves" value={fmtCurrency(monthlyReserves)} color={monthlyReserves > 0 ? 'var(--ar-pos)' : 'var(--ar-warn)'} />
            </ModalSection>
            <ModalSection title="FUND GOALS">
              {customFunds.length > 0 ? customFunds.map(fund => {
                const filled = fundFillMonths[fund.id];
                const hasSeed = fund.seed > 0;
                return (
                  <MR key={fund.id} label={fund.name || fund.label || 'Fund'}
                    value={[fmtCurrency(fund.target ?? 0), hasSeed ? `seed ${fmtCurrency(fund.seed)}` : null, filled ? `filled ${filled}` : 'unfilled'].filter(Boolean).join(' · ')} />
                );
              }) : <div style={{ fontSize: 13, color: 'var(--ar-muted)', padding: '4px 0' }}>No funds configured.</div>}
            </ModalSection>
            <ModalSection title="REFINANCE PLAN">
              <MR label="Refi date" value={refiDate || '—'} />
              <MR label="Target payment" value={s3.targetPayment ? fmtCurrency(s3.targetPayment) : '—'} />
              <MR label="Balance at refi" value={balAtRefi ? fmtCurrency(balAtRefi) : '—'} />
              <MR label="Prepay fund at refi" value={prepayBalance ? fmtCurrency(prepayBalance) : '—'} />
              <MR label="New mortgage balance" value={fmtCurrency(newLoanBal)} />
              <MR label="Payment at existing rate" value={paymentAtExistingRate ? fmtCurrency(paymentAtExistingRate) : '—'} />
              <MR label="Max refi rate (no extra prepay)" value={sim?.infeasibleWithPrepay ? 'Not achievable' : fmtRate(sim?.reqRateWithPrepay)} />
            </ModalSection>
          </div>
        </div>

        {/* Desktop notes */}
        <div className="ar-modal-desktop" style={{ gridTemplateColumns: '1fr', marginTop: 8 }}>
          <ModalSection title="NOTES">
            <textarea value={note} onChange={e => setNote(e.target.value)} onBlur={handleNoteBlur}
              placeholder="Add notes about this scenario…" rows={3} className="ar-input"
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} />
            <div style={{ fontSize: 11, color: 'var(--ar-muted)', marginTop: 4 }}>Auto-saves on blur.</div>
          </ModalSection>
        </div>

        {/* Mobile tab content */}
        <div className="ar-modal-mobile-content">
          {tab === 'overview' && <>
            <ModalSection title="SAVINGS PLAN">
              <MR label="Monthly saving" value={monthlyContrib ? fmtCurrency(monthlyContrib) : '—'} />
              <MR label="First available" value={fmtMonthLabel(purchaseMonth, 0)} />
            </ModalSection>
            <ModalSection title="PURCHASE">
              <MR label="Home price" value={homePrice ? fmtCurrency(homePrice) : '—'} />
              <MR label="Loan amount" value={loanAmount ? fmtCurrency(loanAmount) : '—'} />
              <MR label="Leftover cash" value={fmtCurrency(leftover)} color={leftover >= 0 ? 'var(--ar-pos)' : 'var(--ar-warn)'} />
            </ModalSection>
            <ModalSection title="MONTHLY PAYMENT">
              <MR label="PITI" value={piti ? fmtCurrency(piti) : '—'} />
              <MR label="Interest rate" value={rate ? `${rate.toFixed(2)}%` : '—'} />
              <MR label="Loan term" value={term ? `${term} yr` : '—'} />
            </ModalSection>
          </>}
          {tab === 'budget' && <>
            <ModalSection title="MONTHLY BUDGET">
              <MR label="Gross income" value={grossIncome ? fmtCurrency(grossIncome) : '—'} />
              <MR label="Other expenses" value={fmtCurrency(otherExp)} />
              <MR label="Monthly reserves" value={fmtCurrency(monthlyReserves)} color={monthlyReserves > 0 ? 'var(--ar-pos)' : 'var(--ar-warn)'} />
            </ModalSection>
            <ModalSection title="FUND GOALS">
              {customFunds.length > 0 ? customFunds.map(fund => {
                const filled = fundFillMonths[fund.id];
                const hasSeed = fund.seed > 0;
                return (
                  <MR key={fund.id} label={fund.name || fund.label || 'Fund'}
                    value={[fmtCurrency(fund.target ?? 0), hasSeed ? `seed ${fmtCurrency(fund.seed)}` : null, filled ? `filled ${filled}` : 'unfilled'].filter(Boolean).join(' · ')} />
                );
              }) : <div style={{ fontSize: 13, color: 'var(--ar-muted)', padding: '4px 0' }}>No funds configured.</div>}
            </ModalSection>
          </>}
          {tab === 'refi' && <>
            <ModalSection title="REFINANCE PLAN">
              <MR label="Refi date" value={refiDate || '—'} />
              <MR label="Target payment" value={s3.targetPayment ? fmtCurrency(s3.targetPayment) : '—'} />
              <MR label="Balance at refi" value={balAtRefi ? fmtCurrency(balAtRefi) : '—'} />
              <MR label="Prepay fund at refi" value={prepayBalance ? fmtCurrency(prepayBalance) : '—'} />
              <MR label="New mortgage balance" value={fmtCurrency(newLoanBal)} />
              <MR label="Payment at existing rate" value={paymentAtExistingRate ? fmtCurrency(paymentAtExistingRate) : '—'} />
              <MR label="Max refi rate (no extra prepay)" value={sim?.infeasibleWithPrepay ? 'Not achievable' : fmtRate(sim?.reqRateWithPrepay)} />
            </ModalSection>
          </>}
          {tab === 'notes' && <>
            <ModalSection title="NOTES">
              <textarea value={note} onChange={e => setNote(e.target.value)} onBlur={handleNoteBlur}
                placeholder="Add notes about this scenario…" rows={5} className="ar-input"
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} />
              <div style={{ fontSize: 11, color: 'var(--ar-muted)', marginTop: 4 }}>Auto-saves on blur.</div>
            </ModalSection>
          </>}
        </div>

        {/* Bottom action row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--ar-border)', marginTop: 8 }}>
          <button
            className={`ar-btn${isTarget ? ' ar-btn-ghost' : ' ar-btn-accent'}`}
            onClick={() => onSetTarget(scenario.id)}
          >
            {isTarget ? '✓ Targeted' : 'Set as target'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gallery ─────────────────────────────────────────────────────────────────
export default function ScenariosGallery() {
  const navigate = useNavigate();
  const location = useLocation();
  const { scenarios, deleteScenario, starScenario, targetId, updateNote, reorderScenarios } = useApp();
  const [openId, setOpenId] = useState(() => {
    const params = new URLSearchParams(location.search);
    const openParam = params.get('open');
    return openParam && scenarios.find(s => s.id === openParam) ? openParam : null;
  });
  const [deleteId, setDeleteId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  function handleDragStart(e, id) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  }
  function handleDragOver(e, id) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragId) setDragOverId(id);
  }
  function handleDrop(e, id) {
    e.preventDefault();
    if (dragId && id !== dragId) {
      const fromIdx = scenarios.findIndex(s => s.id === dragId);
      const toIdx   = scenarios.findIndex(s => s.id === id);
      reorderScenarios(fromIdx, toIdx);
    }
    setDragId(null);
    setDragOverId(null);
  }
  function handleDragEnd() {
    setDragId(null);
    setDragOverId(null);
  }

  const openScenario = scenarios.find(s => s.id === openId);
  const deleteScenario_ = scenarios.find(s => s.id === deleteId);

  function handleSetTarget(id) {
    starScenario(id);
  }

  function handleDelete(id) {
    setDeleteId(id);
  }

  function confirmDelete() {
    deleteScenario(deleteId);
    if (openId === deleteId) setOpenId(null);
    setDeleteId(null);
  }

  function handleEdit(id) {
    setOpenId(null);
    navigate('/calculator?edit=' + id);
  }

  return (
    <>
      <GlobalHeader />
      <div className="ar-scroll">
        <div className="ar-container">
          {/* Page header — only shown when there are scenarios */}
          {scenarios.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div className="ar-label" style={{ color: 'var(--ar-muted, #888)', marginBottom: 6 }}>
                  Saved scenarios
                </div>
                <h1 className="ar-display" style={{ fontSize: 40, fontWeight: 400, margin: 0, lineHeight: 1.05 }}>
                  {scenarios.length === 1 ? '1 scenario' : `${scenarios.length} scenarios`}
                </h1>
              </div>
              <button className="ar-btn ar-btn-accent" onClick={() => navigate('/calculator')}>
                + New scenario
              </button>
            </div>
          )}

          {/* Empty state */}
          {scenarios.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 32px' }}>
              <div className="ar-display" style={{ fontSize: 56, fontWeight: 400, marginBottom: 16, lineHeight: 1.1 }}>
                No scenarios saved
              </div>
              <p style={{ fontSize: 16, color: 'var(--ar-muted)', marginBottom: 32, maxWidth: 380, margin: '0 auto 32px' }}>
                Create your first scenario to start comparing home purchase options.
              </p>
              <button className="ar-btn ar-btn-accent" onClick={() => navigate('/calculator')}>
                + New scenario
              </button>
            </div>
          )}

          {/* Scenario grid */}
          {scenarios.length > 0 && (
            <div className="ar-scenario-grid">
              {scenarios.map(scenario => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  isTarget={scenario.id === targetId}
                  onSetTarget={handleSetTarget}
                  onDelete={handleDelete}
                  onOpenModal={setOpenId}
                  onEdit={handleEdit}
                  isDragging={dragId === scenario.id}
                  isDragOver={dragOverId === scenario.id}
                  onDragStart={e => handleDragStart(e, scenario.id)}
                  onDragOver={e => handleDragOver(e, scenario.id)}
                  onDrop={e => handleDrop(e, scenario.id)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="ar-modal-bg" onClick={() => setDeleteId(null)}>
          <div className="ar-modal" style={{ maxWidth: 400, padding: 32 }} onClick={e => e.stopPropagation()}>
            <div className="ar-label" style={{ marginBottom: 8 }}>Delete scenario</div>
            <h2 className="ar-display" style={{ fontSize: 22, fontWeight: 400, margin: '0 0 10px' }}>
              Delete this scenario?
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ar-muted)', margin: '0 0 24px' }}>
              <strong style={{ color: 'var(--ar-fg)' }}>{deleteScenario_?.name || 'This scenario'}</strong> will be permanently deleted and cannot be recovered.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="ar-btn ar-btn-accent"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={confirmDelete}
              >
                Delete
              </button>
              <button
                className="ar-btn ar-btn-ghost"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setDeleteId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scenario modal */}
      {openScenario && (
        <ScenarioModal
          scenario={openScenario}
          isTarget={openScenario.id === targetId}
          onClose={() => setOpenId(null)}
          onSetTarget={handleSetTarget}
          onEdit={handleEdit}
          updateNote={updateNote}
        />
      )}
    </>
  );
}
