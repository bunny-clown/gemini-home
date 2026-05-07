import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GlobalHeader from '../Common/GlobalHeader';
import { useApp } from '../../contexts/AppContext';
import { fmtCurrency, calcPI, buildRefiSimulation, monthsBetween } from '../../utils/calculations';

function SectionLabel({ children }) {
  return (
    <div className="ar-label" style={{ color: 'var(--ar-accent)', letterSpacing: '0.12em', fontSize: 11, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '7px 0', borderBottom: '1px solid var(--ar-border)' }}>
      <span style={{ color: 'var(--ar-muted)' }}>{label}</span>
      <span className="ar-num" style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function KV({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '7px 0', borderBottom: '1px solid var(--ar-border)' }}>
      <span style={{ color: 'var(--ar-muted)' }}>{label}</span>
      <span className="ar-num" style={{ fontWeight: 500, color: color || 'var(--ar-fg)' }}>{value ?? '—'}</span>
    </div>
  );
}

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ padding: '14px 0' }}>
      <div className="ar-label" style={{ marginBottom: 4 }}>{label}</div>
      <div className="ar-display ar-num" style={{ fontSize: 24, color: color || 'var(--ar-fg)' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ar-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function fmtReqRate(sim) {
  if (!sim) return '—';
  if (sim.newLoanBalance != null && sim.newLoanBalance <= 0) return 'Fully covered';
  if (sim.infeasibleWithPrepay) return 'Not achievable (even at 0%)';
  const r = sim.reqRateWithPrepay;
  if (r == null || isNaN(r)) return '—';
  if (r === 0) return '~0% (any rate works)';
  return `${r.toFixed(2)}%`;
}

export default function ScenarioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { scenarios, deleteScenario, saveScenario, starScenario, targetId, updateNote } = useApp();
  const scenario = scenarios.find(s => s.id === id);

  const [note, setNote] = useState(scenario?.note || '');

  const s1 = scenario?.step1 || {};
  const s2 = scenario?.step2 || {};
  const s3 = scenario?.step3 || {};

  const initialSavings   = s1.initialSavings   || 0;
  const monthlyContrib   = s1.monthlyContrib   || 0;
  const projectionMonths = s1.projectionMonths || 36;
  const downPct          = s1.downPct          || 20;
  const startMonth       = s1.startMonth       || '';
  const homePrice        = s1.selectedPrice    || 0;
  const purchaseMonth    = s1.selectedPurchaseMonth || s1.startMonth || '';
  const selectedBalance  = s1.selectedBalance  || 0;
  const amountRequired   = homePrice > 0 ? homePrice * (downPct + 4) / 100 : 0;
  const leftover         = homePrice > 0 ? selectedBalance - amountRequired : null;
  const monthsToSave     = leftover != null && leftover < 0 && monthlyContrib > 0
    ? Math.ceil(-leftover / monthlyContrib) : null;

  const piti             = s2.piti             || 0;
  const rate             = s2.mortgageRate     || 0;
  const term             = s2.loanTerm         || 30;
  const grossIncome      = s2.grossMonthlyIncome || 0;
  const otherExp         = s2.otherMonthlyExpenses || 0;
  const monthlyReserves  = s2.monthlyReserves  || Math.max(0, grossIncome - otherExp - piti);
  const loanAmount       = homePrice * (1 - downPct / 100);

  const refiDate         = s3.refiDate         || '';
  const targetPayment    = s3.targetPayment    || 0;
  const customFunds      = s3.customFunds      || [];
  const monthsToRefi     = refiDate ? monthsBetween(purchaseMonth, refiDate) : 0;

  const sim = useMemo(() => {
    if (!scenario || !homePrice || !loanAmount || !refiDate) return null;
    try {
      return buildRefiSimulation({
        purchasePrice: homePrice, loanAmount,
        purchaseRate: rate, loanTerm: term,
        purchaseMonth, refiDateStr: refiDate,
        targetPayment,
        emergencyTarget: 0, renovTarget: 0,
        customFunds,
        refiRate: rate || 5.5,
        fundOrder: s3.fundOrder || [],
        monthlyFundContrib: monthlyReserves,
      });
    } catch { return null; }
  }, [scenario]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!scenario) {
    return (
      <>
        <GlobalHeader />
        <div className="ar-scroll">
          <div className="ar-container" style={{ textAlign: 'center', paddingTop: 80 }}>
            <h2 className="ar-display" style={{ fontSize: 28, margin: '0 0 8px', fontWeight: 400 }}>Scenario not found</h2>
            <button className="ar-btn ar-btn-ghost" onClick={() => navigate('/scenarios')}>Back to Scenarios</button>
          </div>
        </div>
      </>
    );
  }

  const isTarget = scenario.id === targetId;

  const handleDuplicate = () => {
    const id2 = saveScenario({ ...scenario, id: undefined, name: `${scenario.name || 'Scenario'} (Copy)`, createdAt: undefined });
    navigate(`/scenarios/${id2}`);
  };
  const handleNoteBlur = () => updateNote && updateNote(id, note);

  const paymentAtInitialRate = sim?.newLoanBalance > 0 && rate > 0
    ? calcPI(sim.newLoanBalance, rate, term) : 0;

  const simFunds = (sim?.allFunds || []).filter(f => f.id !== 'emergency' && f.id !== 'renov');

  return (
    <>
      <GlobalHeader />
      <div className="ar-scroll">
        <div className="ar-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="ar-label">Scenario detail</div>
              <h1 className="ar-display" style={{ fontSize: 40, margin: '6px 0 4px', fontWeight: 400 }}>
                {scenario.name || 'Unnamed Scenario'}
              </h1>
              {isTarget && <span className="ar-chip">◉ Target scenario</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="ar-btn ar-btn-ghost" onClick={() => starScenario(id)}>
                {isTarget ? '★ Targeted' : '☆ Set as target'}
              </button>
              <button className="ar-btn ar-btn-ghost" onClick={handleDuplicate}>Duplicate</button>
              <button className="ar-btn ar-btn-ghost" onClick={() => navigate(`/calculator?edit=${id}`)}>Edit →</button>
              <button
                className="ar-btn ar-btn-ghost"
                style={{ color: 'var(--ar-warn)', borderColor: 'rgba(194,85,58,0.2)' }}
                onClick={() => { if (window.confirm('Delete this scenario?')) { deleteScenario(id); navigate('/scenarios'); } }}
              >
                Delete
              </button>
            </div>
          </div>

          {/* ── SAVINGS ──────────────────────────────────────────────────────── */}
          <div className="ar-card">
            <SectionLabel>SAVINGS</SectionLabel>
            <div className="ar-grid-4" style={{ marginBottom: 16 }}>
              <StatBox label="Starting balance" value={fmtCurrency(initialSavings)} />
              <StatBox label="Monthly contribution" value={fmtCurrency(monthlyContrib)} />
              <StatBox label="Projection window" value={`${projectionMonths} mo`} />
              <StatBox label="Down payment" value={`${downPct}%`} />
            </div>
            <KV label="Savings start month" value={startMonth || '—'} />
          </div>

          {/* ── SELECTED HOME ─────────────────────────────────────────────────── */}
          <div className="ar-card">
            <SectionLabel>SELECTED HOME</SectionLabel>
            <KV label="Home price" value={homePrice ? fmtCurrency(homePrice) : '—'} />
            <KV label="Purchase month" value={purchaseMonth || '—'} />
            <KV label="Amount required (down + 4% closing)" value={homePrice ? fmtCurrency(amountRequired) : '—'} />
            {leftover === null ? (
              <KV label="Leftover / short" value="Select a home in the savings tab" />
            ) : (
              <KV
                label={leftover >= 0 ? 'Leftover cash' : 'Short by'}
                value={`${fmtCurrency(Math.abs(leftover))}${monthsToSave != null ? ` (${monthsToSave} mo to save)` : ''}`}
                color={leftover >= 0 ? 'var(--ar-pos)' : 'var(--ar-warn)'}
              />
            )}
          </div>

          {/* ── PAYMENT ──────────────────────────────────────────────────────── */}
          <div className="ar-card">
            <SectionLabel>PAYMENT</SectionLabel>
            <div className="ar-grid-2" style={{ gap: 32 }}>
              <div>
                <StatBox
                  label="Monthly PITI"
                  value={fmtCurrency(piti)}
                  sub={rate > 0 ? `${rate.toFixed(2)}% · ${term} yr · ${fmtCurrency(loanAmount)} loan` : undefined}
                />
              </div>
              <div>
                <StatBox
                  label="Monthly reserves"
                  value={fmtCurrency(monthlyReserves)}
                  color={monthlyReserves > 0 ? 'var(--ar-pos)' : 'var(--ar-warn)'}
                  sub="Fills reserve funds each month"
                />
              </div>
            </div>
          </div>

          {/* ── REFINANCE PLAN ────────────────────────────────────────────────── */}
          <div className="ar-card">
            <SectionLabel>REFINANCE PLAN</SectionLabel>
            {!refiDate ? (
              <div style={{ fontSize: 13, color: 'var(--ar-muted)', padding: '8px 0' }}>
                No refinance date set — configure in the refinance tab.
              </div>
            ) : (
              <div>
                <KV label="Refi date" value={refiDate} />
                <KV label="Months to refi" value={monthsToRefi > 0 ? monthsToRefi : '—'} />
                <KV label="Target payment" value={targetPayment > 0 ? fmtCurrency(targetPayment) : '—'} />
                <KV label="Balance at refi" value={sim?.balAtRefi != null ? fmtCurrency(sim.balAtRefi) : '—'} />
                <KV label="Prepay fund at refi" value={sim?.prepayFundBalance != null ? fmtCurrency(sim.prepayFundBalance) : '—'} />
                {paymentAtInitialRate > 0 && rate > 0 && (
                  <KV label={`Payment at initial rate (${rate.toFixed(2)}%)`} value={fmtCurrency(paymentAtInitialRate)} />
                )}
                <KV
                  label="Max rate without extra prepay"
                  value={fmtReqRate(sim)}
                  color={
                    sim?.infeasibleWithPrepay ? 'var(--ar-warn)'
                    : (sim?.reqRateWithPrepay > 0 ? 'var(--ar-pos)' : undefined)
                  }
                />
              </div>
            )}
          </div>

          {/* ── RESERVE FUNDS ─────────────────────────────────────────────────── */}
          <div className="ar-card">
            <SectionLabel>RESERVE FUNDS</SectionLabel>
            {customFunds.length === 0 && !sim ? (
              <div style={{ fontSize: 13, color: 'var(--ar-muted)', padding: '8px 0' }}>
                No reserve funds configured — add funds in the refinance tab.
              </div>
            ) : (
              <div className="ar-table-wrap" style={{ overflowX: 'auto' }}>
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>Fund</th>
                      <th style={{ textAlign: 'right' }}>Target</th>
                      <th style={{ textAlign: 'right' }}>Seed</th>
                      <th style={{ textAlign: 'right' }}>Balance at refi</th>
                      <th style={{ textAlign: 'right' }}>Month filled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customFunds.map(fund => {
                      const fillMonth = sim?.fundFillMonths?.[fund.id] ?? '—';
                      const atRefi = sim?.fundBalancesAtRefi?.[fund.id] ?? null;
                      const fundInSim = sim?.allFunds?.find(f => f.id === fund.id);
                      const balanceAtRefi = atRefi != null ? atRefi : (fundInSim?.balance ?? null);
                      return (
                        <tr key={fund.id}>
                          <td>{fund.name || fund.label}</td>
                          <td style={{ textAlign: 'right' }}>{fmtCurrency(fund.target ?? 0)}</td>
                          <td style={{ textAlign: 'right' }}>{fund.seed > 0 ? fmtCurrency(fund.seed) : '—'}</td>
                          <td style={{ textAlign: 'right' }}>{balanceAtRefi != null ? fmtCurrency(balanceAtRefi) : '—'}</td>
                          <td style={{ textAlign: 'right' }}>{fillMonth}</td>
                        </tr>
                      );
                    })}
                    {sim && (
                      <tr>
                        <td style={{ color: 'var(--ar-muted)' }}>Prepay fund</td>
                        <td style={{ textAlign: 'right' }}>—</td>
                        <td style={{ textAlign: 'right' }}>—</td>
                        <td style={{ textAlign: 'right' }}>{sim.prepayFundBalance != null ? fmtCurrency(sim.prepayFundBalance) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>—</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── FUND BALANCES BY MONTH ────────────────────────────────────────── */}
          <div className="ar-card">
            <SectionLabel>FUND BALANCES BY MONTH</SectionLabel>
            {!sim || sim.rows.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ar-muted)', padding: '8px 0' }}>
                Set a refi date and home price to see monthly fund balances.
              </div>
            ) : (
              <div className="ar-table-wrap" style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
                <table className="ar-table" style={{ fontSize: 12, minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th style={{ textAlign: 'right' }}>Mortgage bal.</th>
                      <th style={{ textAlign: 'right' }}>Equity</th>
                      {simFunds.map(f => (
                        <th key={f.id} style={{ textAlign: 'right' }}>{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sim.rows.map((row, i) => {
                      const isRefi = i === monthsToRefi;
                      return (
                        <tr key={i} style={isRefi ? { background: 'rgba(72,56,245,0.06)', fontWeight: 700 } : {}}>
                          <td style={{ whiteSpace: 'nowrap' }}>{row.label}{isRefi ? ' ★' : ''}</td>
                          <td style={{ textAlign: 'right', color: 'var(--ar-warn)' }}>{fmtCurrency(row.mortgageBal)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--ar-pos)' }}>{fmtCurrency(row.equity)}</td>
                          {simFunds.map(f => {
                            const fd = row.funds?.find(x => x.id === f.id);
                            const isFull = fd && f.target !== Infinity && fd.balance >= f.target;
                            return (
                              <td key={f.id} style={{ textAlign: 'right', color: isFull ? 'var(--ar-pos)' : 'var(--ar-fg)' }}>
                                {fmtCurrency(fd?.balance ?? 0)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── NOTES ────────────────────────────────────────────────────────── */}
          <div className="ar-card">
            <div className="ar-label" style={{ marginBottom: 10 }}>Notes</div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="Add notes about this scenario…"
              rows={4}
              className="ar-input"
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ fontSize: 12, color: 'var(--ar-muted)', marginTop: 6 }}>Auto-saves on blur.</div>
          </div>

        </div>
      </div>
    </>
  );
}
