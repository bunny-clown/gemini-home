import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import GlobalHeader from '../Common/GlobalHeader';
import {
  fmtCurrency,
  calcPI,
  mortgageBalance,
  monthsBetween,
  buildRefiSimulation,
} from '../../utils/calculations';

function fmtRate(r) {
  if (r == null || isNaN(r) || r === 0) return '—';
  return `${Number(r).toFixed(2)}%`;
}

function fmtMonths(n) {
  if (n == null || isNaN(n)) return '—';
  return `${Math.round(n)} mo`;
}

function getMetrics(scenario) {
  if (!scenario) return null;
  const s1 = scenario.step1 || {};
  const s2 = scenario.step2 || {};
  const s3 = scenario.step3 || {};

  const homePrice = s1.selectedPrice || 0;
  const downPct = s1.downPct || 20;
  const dp = homePrice * downPct / 100;
  const closingCosts = homePrice * 0.04;
  const loanAmount = homePrice * (1 - downPct / 100);
  const leftover = (s1.selectedBalance || 0) - dp - closingCosts;
  const piti = s2.piti || 0;
  const rate = s2.mortgageRate || 0;
  const term = s2.loanTerm || 30;
  const grossIncome = s2.grossMonthlyIncome || 0;
  const otherExp = s2.otherMonthlyExpenses || 0;
  const monthlyReserves = s2.monthlyReserves || Math.max(0, grossIncome - otherExp - piti);
  const purchaseMonth = s1.selectedPurchaseMonth || s1.startMonth || '';
  const refiDate = s3.refiDate || '';
  const monthsToRefi = monthsBetween(purchaseMonth, refiDate);
  const balAtRefi = rate && loanAmount
    ? mortgageBalance(loanAmount, rate, term, Math.max(0, monthsToRefi)) : 0;

  const base = {
    homePrice, dp, closingCosts, loanAmount, leftover,
    piti, rate, term, grossIncome, otherExp, monthlyReserves,
    purchaseMonth, refiDate, monthsToRefi, balAtRefi,
    targetPayment: s3.targetPayment || 0,
    testRefiRate: s3.testRefiRate || 0,
    monthlyContrib: s1.monthlyContrib || 0,
    buyAtMonth: s1.buyAtMonth ?? null,
    downPct,
  };

  try {
    const sim = buildRefiSimulation({
      purchasePrice: homePrice, loanAmount,
      purchaseRate: rate, loanTerm: term,
      purchaseMonth, refiDateStr: refiDate,
      targetPayment: s3.targetPayment || 0,
      emergencyTarget: 0, renovTarget: 0,
      customFunds: s3.customFunds || [],
      refiRate: s3.testRefiRate || 5.5,
      fundOrder: s3.fundOrder || [],
      monthlyFundContrib: monthlyReserves,
    });

    const prepayBalance = sim.prepayFundBalance || 0;
    const newLoanBal = Math.max(0, balAtRefi - prepayBalance);
    const fundFillMonths = sim.fundFillMonths || {};

    return {
      ...base,
      prepayBalance,
      newLoanBal,
      reqRateWithPrepay: sim.reqRateWithPrepay,
      infeasible: sim.infeasibleWithPrepay,
      paymentAtExistingRate: rate && newLoanBal ? calcPI(newLoanBal, rate, term) : 0,
      allFunds: (s3.customFunds || []).map(f => ({ ...f, filledMonth: fundFillMonths[f.id] || null })),
    };
  } catch {
    return {
      ...base, prepayBalance: 0, newLoanBal: 0,
      reqRateWithPrepay: null, infeasible: false,
      paymentAtExistingRate: 0, allFunds: [],
    };
  }
}

function bestIdx(values, direction) {
  const nums = values.map(v => (v != null && !isNaN(Number(v)) ? Number(v) : null));
  const valid = nums.filter(n => n !== null);
  if (valid.length < 2) return null;
  const target = direction === 'min' ? Math.min(...valid) : Math.max(...valid);
  return nums.findIndex(n => n === target);
}

const ACCENT_BG = 'rgba(72,56,245,0.07)';
const ACCENT_COLOR = 'var(--ar-accent)';
const MAX_COLS = 3;

function gridCols(n) {
  return `180px repeat(${n}, 1fr)`;
}

function SectionLabel({ children, cols }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: gridCols(cols),
      padding: '16px 0 4px',
    }}>
      <div style={{ gridColumn: '1 / -1', paddingLeft: 0 }}>
        <span className="ar-label" style={{ color: 'var(--ar-accent)', letterSpacing: '0.12em', fontSize: 11 }}>
          {children}
        </span>
      </div>
    </div>
  );
}

function MetricRow({ label, cells, isLast, cols }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: gridCols(cols),
      alignItems: 'stretch',
      borderBottom: isLast ? 'none' : '1px solid var(--ar-border)',
      minHeight: 40,
    }}>
      <div style={{
        fontSize: 13,
        color: 'var(--ar-muted)',
        padding: '10px 16px 10px 0',
        display: 'flex',
        alignItems: 'center',
      }}>
        {label}
      </div>
      {cells.map((cell, i) => (
        <div
          key={i}
          className="ar-num"
          style={{
            fontSize: 14,
            fontWeight: cell.accent ? 600 : 400,
            color: cell.accent ? ACCENT_COLOR : 'var(--ar-fg)',
            background: cell.accent ? ACCENT_BG : 'transparent',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            borderLeft: '1px solid var(--ar-border)',
          }}
        >
          {cell.display}
        </div>
      ))}
    </div>
  );
}

export default function ScenarioCompare() {
  const navigate = useNavigate();
  const { scenarios, compareIds } = useApp();

  const [colIds, setColIds] = useState(() => {
    const ids = scenarios.map(s => s.id);
    const seed = compareIds && compareIds.length ? compareIds : [];
    return [
      seed[0] || ids[0] || null,
      seed[1] || ids[1] || null,
    ];
  });

  const cols = colIds.length;

  function setCol(colIndex, id) {
    setColIds(prev => { const next = [...prev]; next[colIndex] = id || null; return next; });
  }

  function addCol() {
    setColIds(prev => {
      if (prev.length >= MAX_COLS) return prev;
      const used = new Set(prev.filter(Boolean));
      const nextId = scenarios.find(s => !used.has(s.id))?.id || null;
      return [...prev, nextId];
    });
  }

  function removeCol(index) {
    setColIds(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      return next;
    });
  }

  const colScenarios = useMemo(
    () => colIds.map(id => (id ? scenarios.find(s => s.id === id) || null : null)),
    [colIds, scenarios]
  );

  const colMetrics = useMemo(() => colScenarios.map(getMetrics), [colScenarios]);

  if (scenarios.length < 2) {
    return (
      <>
        <GlobalHeader />
        <div className="ar-scroll">
          <div className="ar-container" style={{ textAlign: 'center', paddingTop: 80 }}>
            <h2 className="ar-display" style={{ fontSize: 28, margin: '0 0 12px', fontWeight: 400 }}>
              Not enough scenarios
            </h2>
            <p style={{ color: 'var(--ar-muted)', marginBottom: 24 }}>
              You need at least 2 saved scenarios to compare side by side.
            </p>
            <button className="ar-btn ar-btn-accent" onClick={() => navigate('/calculator')}>
              Go to Calculator
            </button>
          </div>
        </div>
      </>
    );
  }

  function vals(key) {
    return colMetrics.map(m => (m ? m[key] : null));
  }

  function numRow(label, values, direction, format, isLast) {
    const bi = bestIdx(values, direction);
    const cells = values.map((v, i) => ({
      display: v != null && !isNaN(Number(v)) && v !== 0 ? format(v) : '—',
      accent: bi !== null && i === bi,
    }));
    return <MetricRow key={label} label={label} cells={cells} isLast={isLast} cols={cols} />;
  }

  function textRow(label, displays, isLast) {
    return <MetricRow key={label} label={label} cells={displays.map(d => ({ display: d || '—', accent: false }))} isLast={isLast} cols={cols} />;
  }

  function refiRateRow(isLast) {
    const values = colMetrics.map(m => {
      if (!m) return null;
      if (m.infeasible) return 'infeasible';
      return m.reqRateWithPrepay;
    });
    const nums = values.map(v => (v !== null && v !== 'infeasible' ? Number(v) : null));
    const valid = nums.filter(n => n !== null);
    const bestVal = valid.length >= 2 ? Math.max(...valid) : null;
    const cells = values.map(v => {
      if (v === null) return { display: '—', accent: false };
      if (v === 'infeasible') return { display: 'Not achievable', accent: false };
      const accent = bestVal !== null && Number(v) === bestVal;
      return { display: fmtRate(v), accent };
    });
    return <MetricRow key="refi-rate" label="Max refi rate (no extra prepay)" cells={cells} isLast={isLast} cols={cols} />;
  }

  function readyInRow(isLast) {
    const bvals = vals('buyAtMonth');
    const bi = bestIdx(bvals, 'min');
    const cells = bvals.map((v, i) => ({
      display: v != null ? fmtMonths(v) : '—',
      accent: bi !== null && i === bi,
    }));
    return <MetricRow key="ready-in" label="Ready in" cells={cells} isLast={isLast} cols={cols} />;
  }

  function fundRows() {
    const allFundIds = [];
    colMetrics.forEach(m => m?.allFunds.forEach(f => { if (!allFundIds.includes(f.id)) allFundIds.push(f.id); }));

    if (allFundIds.length === 0) {
      return [<MetricRow key="funds-none" label="Custom funds" cells={colMetrics.map(() => ({ display: 'None', accent: false }))} isLast={true} cols={cols} />];
    }

    return allFundIds.map((fid, ri) => {
      const fillNums = colMetrics.map(m => m?.allFunds.find(f => f.id === fid)?.filledMonth ?? null);
      const validFill = fillNums.filter(n => n !== null);
      const bestFill = validFill.length >= 2 ? Math.min(...validFill) : null;
      const isLast = ri === allFundIds.length - 1;

      const cells = colMetrics.map((m, i) => {
        if (!m) return { display: '—', accent: false };
        const fund = m.allFunds.find(f => f.id === fid);
        if (!fund) return { display: '—', accent: false };
        const target = fund.target ? fmtCurrency(fund.target) : '—';
        const filled = fund.filledMonth != null ? `filled ${fund.filledMonth}` : 'unfilled';
        return {
          display: `${target}\n${filled}`,
          accent: bestFill !== null && fillNums[i] === bestFill,
        };
      });

      const fundName = colMetrics.map(m => { const f = m?.allFunds.find(f => f.id === fid); return f?.label || f?.name; }).find(Boolean) || 'Fund';
      return <MetricRow key={fid} label={fundName} cells={cells} isLast={isLast} cols={cols} />;
    });
  }

  return (
    <>
      <GlobalHeader />
      <div className="ar-scroll">
        <div className="ar-container" style={{ paddingBottom: 80 }}>

          {/* Page header */}
          <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="ar-label" style={{ marginBottom: 6, letterSpacing: '0.12em' }}>COMPARE</div>
              <h1 className="ar-display" style={{ fontSize: 36, fontWeight: 400, margin: 0 }}>Side by side</h1>
            </div>
            {cols < MAX_COLS && (
              <button className="ar-btn ar-btn-accent ar-btn-sm" onClick={addCol}>
                + Add scenario
              </button>
            )}
          </div>

          {/* Main card */}
          <div className="ar-card ar-compare-card" style={{ padding: 0 }}>
          <div className="ar-compare-inner">

            {/* Column header row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: gridCols(cols),
              borderBottom: '1px solid var(--ar-border)',
              padding: '0 20px',
            }}>
              <div style={{ padding: '20px 16px' }} />
              {colIds.map((selectedId, ci) => {
                const sc = colScenarios[ci];
                return (
                  <div key={ci} style={{
                    padding: '20px 16px',
                    borderLeft: '1px solid var(--ar-border)',
                    position: 'relative',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div className="ar-label" style={{ fontSize: 10, letterSpacing: '0.14em', marginBottom: 4, color: 'var(--ar-muted)' }}>
                        SCENARIO {ci + 1}
                      </div>
                      {cols > 1 && (
                        <button
                          className="ar-btn ar-btn-ghost ar-btn-sm"
                          style={{ padding: '2px 6px', fontSize: 11, minHeight: 24 }}
                          onClick={() => removeCol(ci)}
                          title="Remove"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="ar-display" style={{
                      fontSize: 20, fontWeight: 500, marginBottom: 10,
                      color: sc ? 'var(--ar-fg)' : 'var(--ar-muted)',
                    }}>
                      {sc ? sc.name || `Scenario ${ci + 1}` : 'None selected'}
                    </div>
                    <select
                      className="ar-input"
                      style={{ width: '100%', fontSize: 13 }}
                      value={selectedId || ''}
                      onChange={e => setCol(ci, e.target.value || null)}
                    >
                      <option value="">— none —</option>
                      {scenarios.map(s => (
                        <option key={s.id} value={s.id}>{s.name || s.id.slice(0, 8)}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Metric rows */}
            <div style={{ padding: '0 20px 12px' }}>

              <div style={{ padding: '0 0 0 0' }}>
                <SectionLabel cols={cols}>PURCHASE</SectionLabel>
                {numRow('Home price', vals('homePrice'), 'min', fmtCurrency)}
                {numRow('Monthly PITI', vals('piti'), 'min', fmtCurrency)}
                {numRow('Down payment', vals('downPct'), 'min', v => `${v}%`)}
                {numRow('Leftover cash after closing', vals('leftover'), 'max', fmtCurrency)}
              </div>

              <div>
                <SectionLabel cols={cols}>SAVINGS PLAN</SectionLabel>
                {numRow('Monthly saving', vals('monthlyContrib'), 'max', fmtCurrency)}
                {readyInRow()}
                {textRow('Purchase month', colMetrics.map(m => m?.purchaseMonth || '—'))}
              </div>

              <div>
                <SectionLabel cols={cols}>MONTHLY BUDGET</SectionLabel>
                {numRow('Gross income', vals('grossIncome'), 'max', fmtCurrency)}
                {numRow('Other expenses', vals('otherExp'), 'min', fmtCurrency)}
                {numRow('Monthly reserves', vals('monthlyReserves'), 'max', fmtCurrency)}
              </div>

              <div>
                <SectionLabel cols={cols}>MONTHLY PAYMENT</SectionLabel>
                {numRow('Rate', vals('rate'), 'min', fmtRate)}
                {textRow('Loan term', colMetrics.map(m => m?.term ? `${m.term} yr` : '—'))}
                {numRow('Loan amount', vals('loanAmount'), 'min', fmtCurrency)}
              </div>

              <div>
                <SectionLabel cols={cols}>REFINANCE PLAN</SectionLabel>
                {textRow('Refi date', colMetrics.map(m => m?.refiDate || '—'))}
                {numRow('Target refinanced payment', vals('targetPayment'), 'min', fmtCurrency)}
                {numRow('Mortgage balance at refi', vals('balAtRefi'), 'min', fmtCurrency)}
                {numRow('Prepayment fund at refi', vals('prepayBalance'), 'max', fmtCurrency)}
                {numRow('New mortgage balance', colMetrics.map(m => m?.newLoanBal ?? null), 'min', fmtCurrency)}
                {numRow('Payment at existing rate', vals('paymentAtExistingRate'), 'min', fmtCurrency)}
                {refiRateRow()}
              </div>

              <div>
                <SectionLabel cols={cols}>RESERVE FUNDS</SectionLabel>
                {fundRows()}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
