import { useState, useMemo, useCallback, useRef } from 'react';
import { buildRefiSimulation, fmtCurrency, fmtMonthLabel, addMonths, generateId, calcPI, mortgageBalance, monthsBetween } from '../../utils/calculations';
import MonthPicker from '../Common/MonthPicker';
import SliderRow from '../Common/SliderRow';
import Stat from '../Common/Stat';

const today = new Date();
const DEFAULT_PURCHASE = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const DEFAULT_REFI = addMonths(DEFAULT_PURCHASE, 24);

const FUND_COLORS = ['#4838f5', '#1fa97a', '#f5b53b', '#c2553a', '#a855f7', '#06b6d4', '#f97316'];

const DEFAULT = {
  refiDate: DEFAULT_REFI,
  targetPayment: 0,
  testRefiRate: 5.5,
  customFunds: [],
  fundOrder: [],
  seedOrder: [],
};

// ── Fund balance chart ──────────────────────────────────────────────────────
function FundChart({ rows, funds, refiMonth, fundFillMonths, monthlyReserves }) {
  const [hoveredCol, setHoveredCol] = useState(null);
  const containerRef = useRef(null);

  const w = 920, h = 220;
  const BAR_PAD = 1;
  if (!rows?.length) return null;

  const maxTotal = Math.max(
    ...rows.map(row => row.funds ? row.funds.reduce((s, f) => s + f.balance, 0) : 0),
    1
  );

  const colWidth = w / rows.length;

  // Compute fill badge months (first fill month per fund)
  const fillBadgeMonths = {};
  for (const [fundId, monthLabel] of Object.entries(fundFillMonths || {})) {
    const idx = rows.findIndex(r => r.label === monthLabel);
    if (idx >= 0) fillBadgeMonths[fundId] = idx;
  }

  // Build tooltip content for hovered col
  let tooltip = null;
  if (hoveredCol !== null && rows[hoveredCol]) {
    const row = rows[hoveredCol];
    tooltip = {
      label: row.label,
      filledFund: row.filledFund,
      funds: funds.map(f => {
        const fd = row.funds?.find(x => x.id === f.id);
        const balance = fd?.balance ?? 0;
        const target = f.target;
        return { ...f, balance, target };
      }),
    };
  }

  // Tooltip x position
  const tooltipX = hoveredCol !== null
    ? Math.min(Math.max((hoveredCol / rows.length) * 100, 5), 70)
    : 0;

  return (
    <div ref={containerRef} className="ar-fund-chart-wrap" style={{ position: 'relative' }}>
      <div className="ar-fund-chart-scroll-inner">
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', display: 'block' }}
        onMouseLeave={() => setHoveredCol(null)}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(p => (
          <line key={p} x1="0" x2={w} y1={h * p} y2={h * p}
            stroke="rgba(0,0,0,0.05)" strokeDasharray="2,4" />
        ))}

        {/* Bars */}
        {rows.map((row, i) => {
          const x = i * colWidth;
          const bw = Math.max(colWidth - BAR_PAD, 1);
          let acc = h;
          const barSegments = funds.map(f => {
            const fd = row.funds?.find(x => x.id === f.id);
            const v = fd?.balance ?? 0;
            const segH = Math.max((v / maxTotal) * (h - 10), 0);
            const y = acc - segH;
            acc = y;
            return { f, v, y, segH };
          });

          // Fill badge: check if any fund fills this col
          const fillBadge = Object.entries(fillBadgeMonths)
            .filter(([, idx]) => idx === i)
            .map(([fid]) => fid);

          return (
            <g key={i}>
              {barSegments.map(({ f, y, segH }) => (
                <rect key={f.id + i}
                  x={x} y={y} width={bw} height={segH}
                  fill={f.color} opacity={hoveredCol === i ? 1 : 0.82}
                />
              ))}
              {/* Fill badge checkmark */}
              {fillBadge.length > 0 && (
                <text x={x + bw / 2} y={Math.min(...barSegments.map(b => b.y)) - 2}
                  textAnchor="middle" fontSize="9" fill="var(--ar-pos)" fontWeight="700">✓</text>
              )}
              {/* Refi marker */}
              {i === refiMonth && (
                <>
                  <line x1={x} x2={x} y1={0} y2={h}
                    stroke="var(--ar-fg)" strokeWidth="1.5" strokeDasharray="3,3" />
                  <text x={x + 3} y={18} fontSize="18" fill="var(--ar-fg)" fontWeight="600">refi</text>
                </>
              )}
              {/* Invisible hover/touch rect */}
              <rect x={x} y={0} width={colWidth} height={h} fill="transparent"
                onMouseEnter={() => setHoveredCol(i)}
                onTouchStart={e => { e.preventDefault(); setHoveredCol(hoveredCol === i ? null : i); }} />
            </g>
          );
        })}
      </svg>

      {/* X-axis labels below SVG */}
      <div style={{ position: 'relative', height: 18, marginTop: 2, overflowX: 'hidden' }}>
        {rows.map((row, i) => {
          if (rows.length <= 12 ? i % 2 !== 0 : i % Math.ceil(rows.length / 8) !== 0) return null;
          return (
            <span key={i} style={{
              position: 'absolute',
              left: `${(i / rows.length) * 100}%`,
              transform: 'translateX(-50%)',
              fontSize: 10,
              color: 'var(--ar-muted)',
              whiteSpace: 'nowrap',
            }}>{row.label}</span>
          );
        })}
      </div>
      </div>{/* end ar-fund-chart-scroll-inner */}

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: `${tooltipX}%`,
          background: 'var(--ar-surface, #fff)',
          border: '1px solid var(--ar-border, #e5e7eb)',
          borderRadius: 8,
          padding: '10px 14px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          zIndex: 10,
          minWidth: 200,
          pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{tooltip.label}</div>
          {tooltip.funds.map(f => (
            <div key={f.id} style={{ display: 'flex', flexDirection: 'column', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: f.color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{f.label}</span>
                <span style={{ fontSize: 12, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCurrency(f.balance)}
                </span>
              </div>
              {f.target !== Infinity && (
                <div style={{ paddingLeft: 14, fontSize: 11, marginTop: 2 }}>
                  {f.balance >= f.target ? (
                    <span style={{ color: 'var(--ar-pos, #1fa97a)' }}>✓ Filled</span>
                  ) : (
                    <span style={{ color: 'var(--ar-muted)' }}>
                      {fmtCurrency(f.target - f.balance)} more to fill
                      {' · '}~{Math.ceil((f.target - f.balance) / Math.max(1, monthlyReserves))} months
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          {tooltip.filledFund && (
            <div style={{ fontSize: 11, color: 'var(--ar-muted)', borderTop: '1px solid var(--ar-border, #e5e7eb)', paddingTop: 6, marginTop: 4 }}>
              Contributing to: <strong>{tooltip.filledFund}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Table view ──────────────────────────────────────────────────────────────
function FundTable({ rows, funds, refiMonth, fundFillMonths }) {
  if (!rows?.length) return <div style={{ color: 'var(--ar-muted)', fontSize: 13 }}>No data.</div>;

  // For each fund, find the row index when it first filled
  const fillRowIdxs = {};
  for (const [fid, label] of Object.entries(fundFillMonths || {})) {
    const idx = rows.findIndex(r => r.label === label);
    if (idx >= 0) fillRowIdxs[fid] = idx;
  }

  return (
    <div className="ar-table-wrap" style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto', width: '100%' }}>
      <table className="ar-table" style={{ fontSize: 12, minWidth: 600 }}>
        <thead>
          <tr>
            <th>Month</th>
            {funds.map(f => (
              <th key={f.id} style={{ textAlign: 'center', color: f.color }}>
                {f.label}
              </th>
            ))}
            <th style={{ textAlign: 'center' }}>Filling</th>
            <th style={{ textAlign: 'center' }}>Mortgage Bal</th>
            <th style={{ textAlign: 'center' }}>Equity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isRefi = i === refiMonth;
            return (
              <tr key={i} style={isRefi ? { background: 'var(--ar-accent-subtle, rgba(72,56,245,0.06))' } : {}}>
                <td style={{ fontWeight: isRefi ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {row.label}{isRefi ? ' ★' : ''}
                </td>
                {funds.map(f => {
                  const fd = row.funds?.find(x => x.id === f.id);
                  const balance = fd?.balance ?? 0;
                  const justFilled = fillRowIdxs[f.id] === i;
                  return (
                    <td key={f.id} style={{
                      textAlign: 'center',
                      fontVariantNumeric: 'tabular-nums',
                      color: justFilled ? 'var(--ar-pos, #1fa97a)' : 'var(--ar-fg)',
                      fontWeight: justFilled ? 700 : 400,
                    }}>
                      {fmtCurrency(balance)}{justFilled ? ' ✓' : ''}
                    </td>
                  );
                })}
                <td style={{ fontSize: 11, color: 'var(--ar-muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>
                  {row.filledFund || '—'}
                </td>
                <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCurrency(row.mortgageBal)}
                </td>
                <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCurrency(row.equity)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Step3 ──────────────────────────────────────────────────────────────
export default function Step3({ data, onChange, step1, step2 }) {
  const vals = useMemo(() => ({ ...DEFAULT, ...data }), [data]);
  const set = useCallback((k, v) => onChange({ ...vals, [k]: v }), [vals, onChange]);

  const [chartView, setChartView] = useState('chart'); // 'chart' | 'table'

  // Derived from step1/step2
  const purchaseMonth = step1?.selectedPurchaseMonth || step1?.startMonth || DEFAULT_PURCHASE;
  const homePrice = step1?.selectedPrice || 650000;
  const downPct = step1?.downPct || 20;
  const loanAmount = homePrice * (1 - downPct / 100);
  const purchaseRate = step2?.mortgageRate || 6.85;
  const loanTerm = step2?.loanTerm || 30;
  const pitiTotal = step2?.piti || 0;
  const monthlyReserves = step2?.monthlyReserves || 0;

  const monthsToRefi = useMemo(() =>
    Math.max(0, monthsBetween(purchaseMonth, vals.refiDate)),
    [purchaseMonth, vals.refiDate]
  );

  // Fund order management — only prepay as base fund now
  const baseFundIds = ['prepay', ...(vals.customFunds || []).map(f => f.id)];
  const activeFundOrder = useMemo(() => {
    if (vals.fundOrder.length > 0) {
      return [
        ...new Set([
          ...vals.fundOrder.filter(id => baseFundIds.includes(id)),
          ...baseFundIds.filter(id => !vals.fundOrder.includes(id)),
        ]),
      ];
    }
    return baseFundIds;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals.fundOrder, vals.customFunds]);

  // allFundDefs for display (sorted by priority)
  const allFundDefs = useMemo(() => {
    const defs = [
      { id: 'prepay', label: 'Prepayment Fund', target: Infinity, color: FUND_COLORS[2] },
      ...(vals.customFunds || []).map((f, i) => ({
        ...f,
        color: FUND_COLORS[(i + 3) % FUND_COLORS.length],
      })),
    ];
    return defs
      .map(f => ({ ...f, priority: activeFundOrder.indexOf(f.id) }))
      .sort((a, b) => a.priority - b.priority);
  }, [vals.customFunds, activeFundOrder]);

  const sim = useMemo(() => buildRefiSimulation({
    purchasePrice: homePrice,
    loanAmount,
    purchaseRate,
    loanTerm,
    purchaseMonth,
    refiDateStr: vals.refiDate,
    targetPayment: vals.targetPayment,
    emergencyTarget: 0,
    renovTarget: 0,
    customFunds: vals.customFunds || [],
    refiRate: vals.testRefiRate,
    fundOrder: activeFundOrder,
    monthlyFundContrib: monthlyReserves,
  }), [homePrice, loanAmount, purchaseRate, loanTerm, purchaseMonth, vals.refiDate, vals.targetPayment, vals.testRefiRate, vals.customFunds, activeFundOrder, monthlyReserves]);

  const balAtRefi = useMemo(() =>
    mortgageBalance(loanAmount, purchaseRate, loanTerm, monthsToRefi),
    [loanAmount, purchaseRate, loanTerm, monthsToRefi]
  );

  const currentPI = useMemo(() => calcPI(loanAmount, purchaseRate, loanTerm), [loanAmount, purchaseRate, loanTerm]);

  // Refinanced payment = calcPI(newLoanBalance, testRefiRate, loanTerm)
  // Uses full loanTerm (new loan at refi), same as reqRateWithPrepay in buildRefiSimulation
  const refinancedPayment = useMemo(() =>
    calcPI(sim.newLoanBalance, vals.testRefiRate, loanTerm),
    [sim.newLoanBalance, vals.testRefiRate, loanTerm]
  );

  const paymentDelta = refinancedPayment - currentPI;

  // Note 1: additional prepayment needed
  const additionalPrepay = useMemo(() => {
    if (!vals.targetPayment || vals.targetPayment <= 0) return null;
    const r = vals.testRefiRate / 100 / 12;
    const n = loanTerm * 12; // new loan at full term
    let reqBalance;
    if (r === 0) {
      reqBalance = vals.targetPayment * n;
    } else {
      const factor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      reqBalance = vals.targetPayment / factor;
    }
    return {
      reqBalance,
      amount: Math.max(0, sim.newLoanBalance - reqBalance),
    };
  }, [vals.targetPayment, vals.testRefiRate, loanTerm, sim.newLoanBalance]);

  const addCustomFund = useCallback(() => {
    const id = generateId();
    onChange({
      ...vals,
      customFunds: [...(vals.customFunds || []), { id, label: 'Custom Fund', target: 10000, seed: 0 }],
      fundOrder: [...activeFundOrder, id],
    });
  }, [vals, activeFundOrder, onChange]);

  const removeCustomFund = useCallback((id) => onChange({
    ...vals,
    customFunds: (vals.customFunds || []).filter(f => f.id !== id),
    fundOrder: activeFundOrder.filter(x => x !== id),
  }), [vals, activeFundOrder, onChange]);

  const updateCustomFund = useCallback((id, field, val) =>
    set('customFunds', (vals.customFunds || []).map(f =>
      f.id === id
        ? { ...f, [field]: (field === 'target' || field === 'seed') ? (parseFloat(val) || 0) : val }
        : f
    )), [vals.customFunds, set]);

  const movePriority = useCallback((id, dir) => {
    const idx = activeFundOrder.indexOf(id);
    const next = [...activeFundOrder];
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    set('fundOrder', next);
  }, [activeFundOrder, set]);

  const customFundIds = (vals.customFunds || []).map(f => f.id);
  const activeSeedOrder = useMemo(() => {
    if (vals.seedOrder && vals.seedOrder.length > 0) {
      return [
        ...new Set([
          ...vals.seedOrder.filter(id => customFundIds.includes(id)),
          ...customFundIds.filter(id => !vals.seedOrder.includes(id)),
        ]),
      ];
    }
    return customFundIds;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals.seedOrder, vals.customFunds]);

  const moveSeedPriority = useCallback((id, dir) => {
    const idx = activeSeedOrder.indexOf(id);
    const next = [...activeSeedOrder];
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    set('seedOrder', next);
  }, [activeSeedOrder, set]);

  const fundAtRefi = (fundId) => {
    const row = sim.rows[Math.min(monthsToRefi - 1, sim.rows.length - 1)];
    return row?.funds?.find(f => f.id === fundId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Summary banner from previous steps ── */}
      <div className="ar-card ar-card-accent ar-card-sm">
        <div className="ar-label" style={{ color: 'var(--ar-accent)', marginBottom: 8 }}>
          Summary · derived from previous steps
        </div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ar-muted)', marginBottom: 2 }}>Home price</div>
            <div className="ar-display ar-num" style={{ fontSize: 32, lineHeight: 1, fontWeight: 700 }}>
              {fmtCurrency(homePrice)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ar-muted)', marginBottom: 2 }}>PITI</div>
            <div className="ar-num" style={{ fontSize: 18, fontWeight: 600 }}>
              {fmtCurrency(pitiTotal)}<span style={{ fontSize: 12, color: 'var(--ar-muted)', fontWeight: 400 }}>/mo</span>
            </div>
          </div>
          {purchaseRate > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--ar-muted)', marginBottom: 2 }}>Rate</div>
              <div className="ar-num" style={{ fontSize: 18, fontWeight: 600 }}>
                {purchaseRate.toFixed(2)}%
              </div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, color: 'var(--ar-muted)', marginBottom: 2 }}>Monthly reserves</div>
            <div className="ar-num" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ar-pos, #1fa97a)' }}>
              {fmtCurrency(monthlyReserves)}<span style={{ fontSize: 12, color: 'var(--ar-muted)', fontWeight: 400 }}>/mo</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Refi settings ── */}
      <div className="ar-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div className="ar-label">Step 3 of 3 · Refinance</div>
          <h2 className="ar-display" style={{ fontSize: 30, margin: '8px 0 0', fontWeight: 400 }}>
            Refinance plan & reserve funds
          </h2>
        </div>

        <div className="ar-grid-2" style={{ gap: 22 }}>
          {/* Left col: date + target payment + test rate */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
              <div className="ar-label" style={{ marginBottom: 8 }}>Refinance date</div>
              <MonthPicker value={vals.refiDate} onChange={v => set('refiDate', v)} />
              <div style={{ fontSize: 12, color: 'var(--ar-muted)', marginTop: 4 }}>
                {monthsToRefi} months after purchase ({fmtMonthLabel(purchaseMonth, monthsToRefi)})
              </div>
            </div>
            <SliderRow
              label="Target refi payment"
              value={vals.targetPayment || Math.round(currentPI * 0.85 / 50) * 50}
              min={500}
              max={Math.round(currentPI) || 4000}
              step={25}
              onChange={v => set('targetPayment', v)}
              display={fmtCurrency(vals.targetPayment || Math.round(currentPI * 0.85 / 50) * 50)}
              editable
            />
            <SliderRow
              label="Test interest rate"
              value={vals.testRefiRate}
              min={3} max={9} step={0.05}
              onChange={v => set('testRefiRate', v)}
              display={`${vals.testRefiRate.toFixed(2)}%`}
              editable
            />
          </div>

          {/* Right col: refinanced payment card + notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* Refinanced payment accent card */}
            <div className="ar-card ar-card-accent ar-card-sm">
              <div className="ar-label" style={{ color: 'var(--ar-accent)' }}>
                Refinanced payment · {vals.testRefiRate.toFixed(2)}% in {fmtMonthLabel(purchaseMonth, monthsToRefi)}
              </div>
              <div className="ar-display ar-num" style={{ fontSize: 28, lineHeight: 1.1, marginTop: 6 }}>
                {fmtCurrency(refinancedPayment)}
                <span style={{ fontSize: 13, color: 'var(--ar-muted)', fontFamily: 'inherit', fontWeight: 400, marginLeft: 4 }}>/ mo P&amp;I</span>
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                <Stat
                  label="vs current P&I"
                  value={(paymentDelta >= 0 ? '+' : '') + fmtCurrency(paymentDelta)}
                  color={paymentDelta < 0 ? 'var(--ar-pos)' : 'var(--ar-warn)'}
                />
                <Stat label="Balance at refi" value={fmtCurrency(balAtRefi)} />
              </div>
            </div>

            {/* Note 1: Additional prepayment needed */}
            {vals.targetPayment > 0 && additionalPrepay !== null && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: additionalPrepay.amount < 100
                  ? 'var(--ar-pos-subtle, rgba(31,169,122,0.08))'
                  : 'var(--ar-warn-subtle, rgba(245,181,59,0.1))',
                border: `1px solid ${additionalPrepay.amount < 100 ? 'var(--ar-pos, #1fa97a)' : 'var(--ar-warn, #f5b53b)'}`,
                fontSize: 13,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--ar-fg)' }}>
                  Additional prepayment needed at {vals.testRefiRate.toFixed(2)}%?
                </div>
                {additionalPrepay.amount < 100 ? (
                  <span style={{ color: 'var(--ar-pos, #1fa97a)' }}>
                    ✓ No additional prepayment needed at this rate.
                  </span>
                ) : (
                  <>
                    <div style={{ color: 'var(--ar-warn, #d97706)' }}>
                      ↑ {fmtCurrency(additionalPrepay.amount)} additional prepayment needed.
                    </div>
                    <div style={{ color: 'var(--ar-warn, #d97706)', marginTop: 4 }}>
                      That's {Math.ceil(additionalPrepay.amount / Math.max(1, monthlyReserves))} more months of full reserves contribution.
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Note 2: Max rate without additional prepayment */}
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--ar-surface-2, rgba(0,0,0,0.03))',
              border: '1px solid var(--ar-border, #e5e7eb)',
              fontSize: 13,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ar-fg)' }}>
                Max refi rate without additional prepayment?
              </div>
              {!vals.targetPayment || vals.targetPayment <= 0 ? (
                <span style={{ color: 'var(--ar-muted)' }}>
                  Enter a target payment and fund information to determine maximum rate.
                </span>
              ) : !vals.refiDate ? (
                <span style={{ color: 'var(--ar-muted)' }}>
                  Enter a refi date to see the maximum achievable rate.
                </span>
              ) : sim.newLoanBalance != null && sim.newLoanBalance <= 0 ? (
                <span style={{ color: 'var(--ar-pos)' }}>
                  ✓ Prepay fund fully covers balance — loan paid off at refi.
                </span>
              ) : sim.infeasibleWithPrepay ? (
                <span style={{ color: 'var(--ar-warn)' }}>
                  ✗ Target payment not achievable even at 0% — increase prepay fund or raise target.
                </span>
              ) : sim.reqRateWithPrepay == null || isNaN(sim.reqRateWithPrepay) ? (
                <span style={{ color: 'var(--ar-warn)' }}>
                  ✗ Could not compute rate — check refi date and target payment.
                </span>
              ) : sim.reqRateWithPrepay === 0 ? (
                <span style={{ color: 'var(--ar-pos)' }}>
                  ✓ Target achievable at any rate (even 0%).
                </span>
              ) : (
                <span style={{
                  display: 'inline-block',
                  background: 'var(--ar-accent)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '3px 12px',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: 0.5,
                }}>
                  {sim.reqRateWithPrepay.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Reserve funds table ── */}
      <div className="ar-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="ar-label">Reserve funds · waterfall priority</div>
            <div style={{ fontSize: 13, color: 'var(--ar-muted)', marginTop: 4 }}>
              Monthly reserves fill funds top-to-bottom. Prepayment fund absorbs all surplus. Use ↑↓ to reorder.
            </div>
          </div>
          <button className="ar-btn ar-btn-accent ar-btn-sm" onClick={addCustomFund}>+ Add fund</button>
        </div>

        <div className="ar-fund-config-scroll">
        <table className="ar-table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>Fill order</th>
              <th>Fund name</th>
              <th style={{ textAlign: 'right' }}>Seed ($)</th>
              <th style={{ width: 70 }}>Seed order</th>
              <th style={{ textAlign: 'right' }}>Target ($)</th>
              <th style={{ textAlign: 'right' }}>At refi</th>
              <th style={{ textAlign: 'center' }}>Month filled</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {allFundDefs.map((f, i) => {
              const atRefi = fundAtRefi(f.id);
              const isCustom = f.id !== 'prepay';
              const fillMonth = sim.fundFillMonths?.[f.id];
              const filled = atRefi && f.target !== Infinity && atRefi.balance >= f.target;
              return (
                <tr key={f.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, width: 20, color: 'var(--ar-muted)' }}>{i + 1}</span>
                      <button className="ar-btn ar-btn-ghost ar-btn-sm" style={{ padding: '3px 6px' }}
                        onClick={() => movePriority(f.id, 'up')} disabled={i === 0}>↑</button>
                      <button className="ar-btn ar-btn-ghost ar-btn-sm" style={{ padding: '3px 6px' }}
                        onClick={() => movePriority(f.id, 'down')} disabled={i === allFundDefs.length - 1}>↓</button>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: f.color, flexShrink: 0 }} />
                      {isCustom ? (
                        <input value={f.label} className="ar-input" style={{ padding: '4px 8px', width: 160, fontSize: 13 }}
                          onChange={e => updateCustomFund(f.id, 'label', e.target.value)} />
                      ) : (
                        <span style={{ fontSize: 13 }}>{f.label}</span>
                      )}
                    </div>
                  </td>
                  {/* Seed column */}
                  <td style={{ textAlign: 'right' }}>
                    {isCustom ? (
                      <input type="number"
                        value={f.seed ?? 0}
                        className="ar-input"
                        style={{ width: 90, textAlign: 'right', padding: '4px 8px', fontSize: 13 }}
                        step={500}
                        onChange={e => updateCustomFund(f.id, 'seed', e.target.value)}
                      />
                    ) : (
                      <span style={{ color: 'var(--ar-muted)', fontSize: 13 }}>—</span>
                    )}
                  </td>
                  {/* Seed priority column */}
                  <td>
                    {isCustom ? (() => {
                      const seedIdx = activeSeedOrder.indexOf(f.id);
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 12, color: 'var(--ar-muted)', width: 16 }}>{seedIdx + 1}</span>
                          <button className="ar-btn ar-btn-ghost ar-btn-sm" style={{ padding: '2px 4px', fontSize: 10 }}
                            onClick={() => moveSeedPriority(f.id, 'up')} disabled={seedIdx === 0}>↑</button>
                          <button className="ar-btn ar-btn-ghost ar-btn-sm" style={{ padding: '2px 4px', fontSize: 10 }}
                            onClick={() => moveSeedPriority(f.id, 'down')} disabled={seedIdx === activeSeedOrder.length - 1}>↓</button>
                        </div>
                      );
                    })() : (
                      <span style={{ color: 'var(--ar-muted)', fontSize: 13 }}>—</span>
                    )}
                  </td>
                  {/* Target column */}
                  <td style={{ textAlign: 'right' }}>
                    {f.id === 'prepay' ? (
                      <span style={{ color: 'var(--ar-muted)', fontSize: 13 }}>∞ (surplus)</span>
                    ) : (
                      <input type="number"
                        value={f.target}
                        className="ar-input"
                        style={{ width: 100, textAlign: 'right', padding: '4px 8px', fontSize: 13 }}
                        step={1000}
                        onChange={e => updateCustomFund(f.id, 'target', e.target.value)}
                      />
                    )}
                  </td>
                  {/* At refi */}
                  <td className="ar-num" style={{ textAlign: 'right' }}>
                    <span style={{
                      fontWeight: 600, fontSize: 13,
                      color: filled ? 'var(--ar-pos, #1fa97a)' : 'var(--ar-fg)',
                    }}>
                      {atRefi ? fmtCurrency(atRefi.balance) : '—'}
                    </span>
                    {f.target !== Infinity && (
                      <span style={{ fontSize: 10, color: 'var(--ar-muted)', marginLeft: 4 }}>
                        / {fmtCurrency(f.target)}
                      </span>
                    )}
                  </td>
                  {/* Month filled */}
                  <td style={{ textAlign: 'center', fontSize: 12 }}>
                    {f.target === Infinity ? (
                      <span style={{ color: 'var(--ar-muted)' }}>—</span>
                    ) : fillMonth ? (
                      <span style={{ color: 'var(--ar-pos, #1fa97a)', fontWeight: 600 }}>{fillMonth}</span>
                    ) : (
                      <span style={{ color: 'var(--ar-muted)' }}>—</span>
                    )}
                  </td>
                  {/* Delete */}
                  <td style={{ textAlign: 'center' }}>
                    {isCustom ? (
                      <button className="ar-btn ar-btn-ghost ar-btn-sm" style={{ padding: '3px 8px' }}
                        onClick={() => removeCustomFund(f.id)}>×</button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* ── Fund balances chart / table ── */}
      <div className="ar-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div className="ar-label">Fund balances · {sim.rows.length} months</div>
          <div className="ar-seg">
            <button
              className={`ar-seg-btn${chartView === 'chart' ? ' active' : ''}`}
              onClick={() => setChartView('chart')}>
              Chart
            </button>
            <button
              className={`ar-seg-btn${chartView === 'table' ? ' active' : ''}`}
              onClick={() => setChartView('table')}>
              Table
            </button>
          </div>
        </div>

        {chartView === 'chart' ? (
          <>
            <FundChart
              rows={sim.rows}
              funds={allFundDefs}
              refiMonth={monthsToRefi}
              fundFillMonths={sim.fundFillMonths || {}}
              monthlyReserves={monthlyReserves}
              purchaseMonth={purchaseMonth}
            />
            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
              {allFundDefs.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: f.color }} />
                  <span style={{ color: 'var(--ar-muted)' }}>{f.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <FundTable
            rows={sim.rows}
            funds={allFundDefs}
            refiMonth={monthsToRefi}
            fundFillMonths={sim.fundFillMonths || {}}
          />
        )}
      </div>
    </div>
  );
}
