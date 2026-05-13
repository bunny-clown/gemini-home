import { useMemo, useState, useRef, useEffect } from 'react';
import { fmtCurrency, fmtYYYYMM, generateId } from '../../utils/calculations';
import SliderRow from '../Common/SliderRow';
import Stat from '../Common/Stat';

const DEFAULT = {
  mortgageRate: 6.85,
  loanTerm: 30,
  propertyTaxPct: 1.2,
  insuranceMonthly: 145,
  hoaMonthly: 0,
  pmiPct: 0.55,
  grossMonthlyIncome: 14500,
  otherMonthlyExpenses: 5400,
  expenseItems: [],
};

function StackedBar({ segments, height = 14, radius = 4 }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  return (
    <div
      className="ar-stacked-bar"
      style={{ height, borderRadius: radius, overflow: 'hidden', background: 'rgba(0,0,0,0.05)', display: 'flex' }}
    >
      {segments.map((s, i) => (
        <div
          key={i}
          title={`${s.label}: ${fmtCurrency(s.value)}`}
          style={{
            width: `${(Math.max(0, s.value) / total * 100).toFixed(1)}%`,
            background: s.color,
            transition: 'width 0.4s cubic-bezier(.2,.7,.2,1)',
          }}
        />
      ))}
    </div>
  );
}

export default function Step2({ data, onChange, step1 }) {
  const vals = { ...DEFAULT, ...data };
  const set = (k, v) => onChange({ ...vals, [k]: v });

  const [expensesOpen, setExpensesOpen] = useState(false);
  const dragId = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);

  // Home price derived from Step 1 savings selection
  const homePrice = step1?.selectedPrice
    || (step1?.selectedBalance
      ? Math.floor(step1.selectedBalance / ((vals.downPct || 20) + 4) * 100 / 1000) * 1000
      : 650000);
  const downPct = step1?.downPct || 20;
  const balanceAtBuy = step1?.selectedBalance ?? null;

  // Banner derived values
  const dp = homePrice * downPct / 100;
  const closingCosts = homePrice * 0.04;
  const loanAmount = homePrice * (1 - downPct / 100);
  const leftover = (step1?.selectedBalance || 0) - dp - closingCosts;

  // Expense items
  const expenseItems = vals.expenseItems || [];
  const expenseItemsTotal = expenseItems.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0);
  const hasItems = expenseItems.length > 0;

  // Computed "other monthly expenses": sum of items if any exist, else slider value
  const computedOtherExp = hasItems ? expenseItemsTotal : vals.otherMonthlyExpenses;

  const { mortgageRate, loanTerm, propertyTaxPct, insuranceMonthly, hoaMonthly, pmiPct } = vals;
  const piti = useMemo(() => {
    const r = mortgageRate / 100 / 12;
    const n = loanTerm * 12;
    const pi = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const taxes = homePrice * (propertyTaxPct / 100) / 12;
    const insurance = insuranceMonthly;
    const hoa = hoaMonthly;
    const pmi = downPct < 20 ? loanAmount * (pmiPct / 100) / 12 : 0;
    const total = pi + taxes + insurance + hoa + pmi;
    return { loan: loanAmount, pi, taxes, insurance, hoa, pmi, total };
  }, [homePrice, downPct, loanAmount, mortgageRate, loanTerm, propertyTaxPct, insuranceMonthly, hoaMonthly, pmiPct]);

  const monthlyReserves = vals.grossMonthlyIncome - piti.total - computedOtherExp;
  const monthlySurplus = Math.max(0, monthlyReserves);
  const incomePct = vals.grossMonthlyIncome > 0 ? (piti.total / vals.grossMonthlyIncome) * 100 : 0;

  // Persist piti, monthlyReserves, and otherMonthlyExpenses into data
  useEffect(() => {
    const newOther = expenseItemsTotal;
    if (
      data?.piti !== piti.total ||
      data?.monthlyReserves !== monthlyReserves ||
      (hasItems && data?.otherMonthlyExpenses !== newOther)
    ) {
      onChange({
        ...vals,
        piti: piti.total,
        pitiData: { ...piti, homePrice, loanAmount: piti.loan },
        monthlyReserves,
        otherMonthlyExpenses: hasItems ? newOther : vals.otherMonthlyExpenses,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piti.total, monthlyReserves, expenseItemsTotal]);

  const pitiSegs = [
    { label: 'Principal & interest', value: piti.pi, color: 'var(--ar-accent)' },
    { label: 'Property tax', value: piti.taxes, color: '#c97b5a' },
    { label: 'Insurance', value: piti.insurance, color: '#5a9eb5' },
    { label: 'PMI', value: piti.pmi, color: 'var(--ar-warn)' },
    { label: 'HOA', value: piti.hoa, color: '#a3a3a3' },
  ];

  // Expense item handlers
  function updateExpenseItem(id, field, rawValue) {
    const coerced = field === 'value' ? parseFloat(rawValue) || 0 : rawValue;
    let updated = expenseItems.map(item =>
      item.id === id ? { ...item, [field]: coerced } : item
    );

    // Auto-move under matching category when category field changes
    if (field === 'category' && typeof coerced === 'string' && coerced.trim()) {
      const cat = coerced.trim().toLowerCase();
      let currentIdx = -1;
      let lastMatchIdx = -1;
      updated.forEach((item, i) => {
        if (item.id === id) currentIdx = i;
        else if (item.category?.trim().toLowerCase() === cat) lastMatchIdx = i;
      });
      if (lastMatchIdx >= 0 && currentIdx !== lastMatchIdx && currentIdx !== lastMatchIdx + 1) {
        const reordered = [...updated];
        const [movedItem] = reordered.splice(currentIdx, 1);
        const adjustedIdx = currentIdx < lastMatchIdx ? lastMatchIdx - 1 : lastMatchIdx;
        reordered.splice(adjustedIdx + 1, 0, movedItem);
        onChange({ ...vals, expenseItems: reordered });
        return;
      }
    }

    onChange({ ...vals, expenseItems: updated });
  }

  function handleDragStart(id) {
    dragId.current = id;
  }

  function handleDragOver(e, id) {
    e.preventDefault();
    setDragOverId(id);
  }

  function handleDrop(e, targetId) {
    e.preventDefault();
    setDragOverId(null);
    const from = dragId.current;
    if (!from || from === targetId) return;
    const next = [...expenseItems];
    const fromIdx = next.findIndex(x => x.id === from);
    const toIdx = next.findIndex(x => x.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);
    onChange({ ...vals, expenseItems: next });
    dragId.current = null;
  }

  function handleDragEnd() {
    setDragOverId(null);
    dragId.current = null;
  }

  function deleteExpenseItem(id) {
    onChange({ ...vals, expenseItems: expenseItems.filter(item => item.id !== id) });
  }

  function addExpenseItem() {
    const newItem = { id: generateId(), name: 'New expense', value: 0, category: '' };
    onChange({ ...vals, expenseItems: [...expenseItems, newItem] });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Home price banner */}
      <div className="ar-card ar-card-accent ar-card-sm">
        <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24 }}>
          {/* Home price — large */}
          <div style={{ flex: '0 0 auto' }}>
            <div className="ar-label" style={{ color: 'var(--ar-accent)' }}>Home price · derived from savings tab</div>
            <div className="ar-display ar-num" style={{ fontSize: 36, lineHeight: 1.1 }}>
              {fmtCurrency(homePrice)}
            </div>
            {step1?.selectedPurchaseMonth && balanceAtBuy != null && (
              <div style={{ fontSize: 13, color: 'var(--ar-muted)', marginTop: 4 }}>
                Buying in{' '}
                <strong style={{ color: 'var(--ar-fg)' }}>{fmtYYYYMM(step1.selectedPurchaseMonth)}</strong>{' '}
                with{' '}
                <strong style={{ color: 'var(--ar-fg)' }}>{fmtCurrency(balanceAtBuy)}</strong> saved.
              </div>
            )}
          </div>

          {/* Smaller stats */}
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap', paddingTop: 4 }}>
            <div>
              <div className="ar-label" style={{ fontSize: 11, marginBottom: 2 }}>Loan amount</div>
              <div className="ar-num" style={{ fontSize: 20, fontWeight: 600 }}>{fmtCurrency(loanAmount)}</div>
              <div style={{ fontSize: 11, color: 'var(--ar-muted)' }}>{(100 - downPct).toFixed(0)}% financed</div>
            </div>
            <div>
              <div className="ar-label" style={{ fontSize: 11, marginBottom: 2 }}>Leftover cash</div>
              <div
                className="ar-num"
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: leftover >= 0 ? 'var(--ar-pos)' : 'var(--ar-warn)',
                }}
              >
                {fmtCurrency(leftover)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ar-muted)' }}>after down + closing costs</div>
            </div>
          </div>

        </div>
      </div>

      {/* PITI inputs + breakdown */}
      <div className="ar-grid-2">
        <div className="ar-card" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <SliderRow
            label="Interest rate"
            value={vals.mortgageRate}
            min={3} max={10} step={0.05}
            onChange={v => set('mortgageRate', v)}
            display={`${vals.mortgageRate.toFixed(2)}%`}
            editable
          />
          <SliderRow
            label="Loan term"
            value={vals.loanTerm}
            min={10} max={30} step={5}
            onChange={v => set('loanTerm', v)}
            display={`${vals.loanTerm} years`}
          />
          <SliderRow
            label="Property tax"
            value={vals.propertyTaxPct}
            min={0} max={3} step={0.05}
            onChange={v => set('propertyTaxPct', v)}
            display={`${vals.propertyTaxPct.toFixed(2)}% / yr`}
            editable
          />
          <SliderRow
            label="Insurance / mo"
            value={vals.insuranceMonthly}
            min={0} max={500} step={5}
            onChange={v => set('insuranceMonthly', v)}
            display={fmtCurrency(vals.insuranceMonthly)}
            editable
          />
          <SliderRow
            label="HOA / mo"
            value={vals.hoaMonthly}
            min={0} max={1000} step={10}
            onChange={v => set('hoaMonthly', v)}
            display={fmtCurrency(vals.hoaMonthly)}
            editable
          />
        </div>

        <div className="ar-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div className="ar-label">— Monthly PITI breakdown</div>
            <div className="ar-display ar-num" style={{ fontSize: 56, lineHeight: 1, marginTop: 6 }}>
              {fmtCurrency(piti.total)}
            </div>
            <div style={{ color: 'var(--ar-muted)', fontSize: 12, letterSpacing: '0.04em', marginTop: 4 }}>
              PER MONTH · ALL-IN
            </div>
          </div>

          <StackedBar segments={pitiSegs} height={28} radius={8} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pitiSegs.filter(s => s.value > 0).map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--ar-muted)' }}>{s.label}</span>
                <span className="ar-num" style={{ fontWeight: 500 }}>{fmtCurrency(s.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Income & monthly reserves */}
      <div className="ar-grid-2">
        {/* Left card: income + expenses */}
        <div className="ar-card" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <div className="ar-label">Income & monthly expenses</div>
            <h3 className="ar-display" style={{ fontSize: 24, margin: '6px 0 0', fontWeight: 400 }}>
              What's left, what to reserve
            </h3>
          </div>

          <SliderRow
            label="Gross monthly income"
            value={vals.grossMonthlyIncome}
            min={3000} max={40000} step={100}
            onChange={v => set('grossMonthlyIncome', v)}
            display={fmtCurrency(vals.grossMonthlyIncome)}
            editable
          />

          {/* Other monthly expenses — slider or computed total */}
          <div>
            {hasItems ? (
              <div className="ar-slider-row">
                <div className="ar-slider-header">
                  <span className="ar-label">Other monthly expenses</span>
                  <span className="ar-num" style={{ fontWeight: 600, fontSize: 14 }}>
                    {fmtCurrency(expenseItemsTotal)}{' '}
                    <span style={{ color: 'var(--ar-muted)', fontWeight: 400, fontSize: 12 }}>computed</span>
                  </span>
                </div>
              </div>
            ) : (
              <SliderRow
                label="Other monthly expenses"
                value={vals.otherMonthlyExpenses}
                min={0} max={20000} step={50}
                onChange={v => set('otherMonthlyExpenses', v)}
                display={fmtCurrency(vals.otherMonthlyExpenses)}
                editable
              />
            )}

            {/* Expand/collapse toggle */}
            <div style={{ marginTop: 16 }}>
              <button
                className="ar-btn ar-btn-ghost ar-btn-sm"
                onClick={() => setExpensesOpen(o => !o)}
                style={{ fontSize: 12 }}
              >
                {expensesOpen ? '▲ Hide breakdown' : '▼ Show expense breakdown'}
                {hasItems && ` (${expenseItems.length} item${expenseItems.length !== 1 ? 's' : ''})`}
              </button>
            </div>

            {/* Expandable expense items */}
            {expensesOpen && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(() => {
                  const rendered = [];
                  let lastCat = '__NONE__';
                  expenseItems.forEach(item => {
                    const cat = item.category?.trim() || '';
                    if (cat && cat !== lastCat) {
                      rendered.push(
                        <div key={`cat-${cat}`} style={{
                          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.06em', color: 'var(--ar-muted)',
                          marginTop: lastCat !== '__NONE__' ? 8 : 0, paddingBottom: 2,
                          borderBottom: '1px solid var(--ar-border)',
                        }}>
                          {cat}
                        </div>
                      );
                    }
                    lastCat = cat || lastCat;
                    rendered.push(
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => handleDragStart(item.id)}
                        onDragOver={e => handleDragOver(e, item.id)}
                        onDrop={e => handleDrop(e, item.id)}
                        onDragEnd={handleDragEnd}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px',
                          background: dragOverId === item.id
                            ? 'var(--ar-accent-soft)'
                            : 'rgba(0,0,0,0.03)',
                          borderRadius: 8, flexWrap: 'wrap',
                          cursor: 'grab',
                          border: dragOverId === item.id
                            ? '1px dashed var(--ar-accent)'
                            : '1px solid transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        <span style={{ color: 'var(--ar-muted)', fontSize: 14, cursor: 'grab', flexShrink: 0 }}>⠿</span>
                        <input
                          className="ar-input"
                          type="text"
                          placeholder="Name"
                          value={item.name}
                          onChange={e => updateExpenseItem(item.id, 'name', e.target.value)}
                          style={{ flex: '1 1 120px', minWidth: 80 }}
                        />
                        <input
                          className="ar-input ar-num"
                          type="number"
                          placeholder="$0"
                          value={item.value}
                          min={0}
                          step={10}
                          onChange={e => updateExpenseItem(item.id, 'value', e.target.value)}
                          style={{ flex: '0 0 90px', width: 90 }}
                        />
                        <input
                          className="ar-input"
                          type="text"
                          placeholder="Category"
                          value={item.category}
                          onChange={e => updateExpenseItem(item.id, 'category', e.target.value)}
                          style={{ flex: '1 1 100px', minWidth: 70 }}
                        />
                        <button
                          className="ar-btn ar-btn-ghost ar-btn-sm"
                          onClick={() => deleteExpenseItem(item.id)}
                          title="Delete"
                          style={{ padding: '2px 6px', color: 'var(--ar-warn)', flexShrink: 0 }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  });
                  return rendered;
                })()}
                <button
                  className="ar-btn ar-btn-accent ar-btn-sm"
                  onClick={addExpenseItem}
                  style={{ alignSelf: 'flex-start', marginTop: 8 }}
                >
                  + Add expense
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right card: Monthly reserves waterfall */}
        <div className="ar-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div className="ar-label">Monthly reserves</div>
            <div style={{ fontSize: 13, color: 'var(--ar-muted)', marginTop: 3 }}>
              This amount will be used to fill your reserve funds on the Refinance step.
            </div>
          </div>

          {/* Waterfall equation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--ar-muted)' }}>+ Gross income</span>
              <span className="ar-num" style={{ fontWeight: 500 }}>{fmtCurrency(vals.grossMonthlyIncome)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--ar-muted)' }}>− PITI</span>
              <span className="ar-num" style={{ fontWeight: 500, color: 'var(--ar-warn)' }}>
                {fmtCurrency(piti.total)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--ar-muted)' }}>− Other expenses</span>
              <span className="ar-num" style={{ fontWeight: 500, color: 'var(--ar-warn)' }}>
                {fmtCurrency(computedOtherExp)}
              </span>
            </div>

            <hr className="ar-divider" style={{ margin: '6px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, color: 'var(--ar-muted)' }}>= Monthly reserves</span>
              <span
                className="ar-display ar-num"
                style={{
                  fontSize: 36,
                  lineHeight: 1,
                  color: monthlyReserves >= 0 ? 'var(--ar-pos)' : 'var(--ar-warn)',
                }}
              >
                {fmtCurrency(monthlyReserves)}
              </span>
            </div>
          </div>

          <hr className="ar-divider" />

          {/* Income breakdown bar */}
          <div>
            <div className="ar-label" style={{ marginBottom: 8 }}>Income breakdown</div>
            <StackedBar
              height={14}
              segments={[
                { label: 'Housing', value: piti.total, color: 'var(--ar-accent)' },
                { label: 'Other expenses', value: computedOtherExp, color: 'var(--ar-warn)' },
                { label: 'Surplus', value: monthlySurplus, color: 'var(--ar-pos)' },
              ]}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 14 }}>
              <Stat label="Housing" value={fmtCurrency(piti.total)} />
              <Stat label="Other" value={fmtCurrency(computedOtherExp)} />
              <Stat
                label="Surplus"
                value={fmtCurrency(monthlySurplus)}
                color={monthlySurplus > 0 ? 'var(--ar-pos)' : 'var(--ar-warn)'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
