export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const CLOSING_PCT = 4;

export function fmtCurrency(n, decimals = 0) {
  if (n == null || isNaN(n)) return '$—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: decimals }).format(n);
}
export function fmtPct(n, decimals = 2) {
  return `${Number(n).toFixed(decimals)}%`;
}
export function fmtYYYYMM(ym) {
  if (!ym) return null;
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${MONTH_NAMES[m - 1]} '${String(y).slice(2)}`;
}
export function fmtMonthLabel(startMonth, offset) {
  if (!startMonth) return '—';
  const d = new Date(startMonth + '-02');
  d.setMonth(d.getMonth() + offset);
  return MONTH_NAMES[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
}
export function monthsBetween(a, b) {
  if (!a || !b) return 0;
  const da = new Date(a + '-02'), db = new Date(b + '-02');
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}
export function addMonths(dateStr, n) {
  const d = new Date((dateStr || new Date().toISOString().slice(0,7)) + '-02');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 7);
}

// Savings timeline projection
export function buildSavingsTimeline(initialSavings, startMonth, monthlyContrib, months, overrides = {}) {
  const rows = [];
  let balance = initialSavings;
  for (let i = 0; i < months; i++) {
    const contrib = overrides[i] !== undefined ? overrides[i] : monthlyContrib;
    balance += contrib;
    rows.push({ month: i, label: fmtMonthLabel(startMonth, i), balance, contrib });
  }
  return rows;
}

// Affordability heatmap — includes months-until-affordable for non-affordable cells
export function buildAffordabilityGrid(savings, closingCostPct, downPct, prices, months) {
  return prices.map(price => {
    return months.map(m => {
      const dp = price * downPct / 100;
      const cc = price * closingCostPct / 100;
      const needed = dp + cc;
      const leftover = savings[m] - needed;
      const affordable = leftover >= 0;

      let monthsUntilAffordable = null;
      if (!affordable) {
        for (let k = m + 1; k < savings.length; k++) {
          if (savings[k] >= needed) { monthsUntilAffordable = k - m; break; }
        }
      }

      return { price, month: m, needed, dp, cc, leftover, affordable, monthsUntilAffordable };
    });
  });
}

// Monthly mortgage payment (P&I)
export function calcPI(principal, annualRate, termYears) {
  if (!principal || principal <= 0) return 0;
  if (annualRate === 0) return principal / (termYears * 12);
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// Mortgage balance after k payments
export function mortgageBalance(principal, annualRate, termYears, kPayments) {
  if (!principal || principal <= 0) return 0;
  if (annualRate === 0) return Math.max(0, principal - (principal / (termYears * 12)) * kPayments);
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  return principal * (Math.pow(1 + r, n) - Math.pow(1 + r, kPayments)) / (Math.pow(1 + r, n) - 1);
}

// Monthly tax + insurance
export function calcTI(homePrice, millRate, annualInsurance) {
  const tax = homePrice * millRate / 1000 / 12;
  const ins = annualInsurance / 12;
  return { tax, ins, total: tax + ins };
}

// Total PITI
export function calcPITI(principal, annualRate, termYears, homePrice, millRate, annualInsurance) {
  const pi = calcPI(principal, annualRate, termYears);
  const { tax, ins } = calcTI(homePrice, millRate, annualInsurance);
  return { pi, tax, ins, total: pi + tax + ins };
}

// Budget breakdown
export function calcBudget(income, piti, expenses, wiggles) {
  const expTotal = expenses.reduce((s, cat) => s + cat.items.reduce((ss, it) => ss + (parseFloat(it.amount) || 0), 0), 0);
  const remaining = income - piti - expTotal - wiggles;
  return { piti, expTotal, wiggles, remaining, income };
}

// Refinance rate needed to hit target P&I payment (bisection)
export function requiredRefinanceRate(balance, targetPayment, termYears) {
  const n = termYears * 12;
  if (!balance || balance <= 0 || !targetPayment || targetPayment <= 0) return null;
  const minPayment = balance / n; // P&I payment at 0% interest (pure principal)
  if (targetPayment < minPayment - 0.005) return null; // infeasible even at 0% rate
  if (targetPayment <= minPayment + 0.005) return 0;   // effectively 0% rate needed
  // Bisection: find annual rate % in [0, 50] such that calcPI(balance, rate, termYears) = targetPayment
  let lo = 0, hi = 50;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const pmt = calcPI(balance, mid, termYears);
    if (pmt > targetPayment) hi = mid;
    else lo = mid;
    if (hi - lo < 0.00001) break;
  }
  return (lo + hi) / 2;
}

// PV of a payment stream: how much principal to have so payment = pmt at rate r for n months
function pvPayment(rate, nMonths, pmt) {
  if (!rate || rate <= 0) return pmt * nMonths;
  const r = rate / 100 / 12;
  return pmt * (1 - Math.pow(1 + r, -nMonths)) / r;
}

// Compute prepayment gap details
export function calcPrepayGap({ balAtRefi, targetPayment, refiRate, loanTerm, loanAmount, purchaseRate, monthsToRefi }) {
  if (!balAtRefi || !targetPayment || !refiRate) return { lumpSum: 0, monthlyExtra: 0, additionalMonths: 0, gap: 0 };

  const refiPI = calcPI(balAtRefi, refiRate, loanTerm);
  const gap = refiPI - targetPayment;

  if (gap <= 0) return { lumpSum: 0, monthlyExtra: 0, additionalMonths: 0, gap: 0, refiPI };

  // Lump sum: target balance at refi rate to produce targetPayment
  const targetBal = pvPayment(refiRate, loanTerm * 12, targetPayment);
  const lumpSum = Math.max(0, balAtRefi - targetBal);

  // Monthly extra to save (as a separate prepayment fund) so you can cover the lump sum by refi date
  const monthlyExtra = monthsToRefi > 0 ? lumpSum / monthsToRefi : lumpSum;

  // Additional months of mortgage payment needed to naturally reach targetBal
  let additionalMonths = 0;
  for (let k = 1; k <= 360; k++) {
    if (mortgageBalance(loanAmount, purchaseRate, loanTerm, monthsToRefi + k) <= targetBal) {
      additionalMonths = k;
      break;
    }
  }
  if (additionalMonths === 0 && mortgageBalance(loanAmount, purchaseRate, loanTerm, monthsToRefi) > targetBal) {
    additionalMonths = 361; // beyond range
  }

  return { lumpSum, monthlyExtra, additionalMonths, gap, refiPI, targetBal };
}

// Refinance simulation — fills funds by priority order using monthly surplus
export function buildRefiSimulation({
  purchasePrice, loanAmount, purchaseRate, loanTerm,
  purchaseMonth, refiDateStr,
  targetPayment,
  emergencyTarget, renovTarget, customFunds,
  seedFund, seedAmount,
  refiRate,
  fundOrder = [], // array of fund IDs in priority order
  monthlyFundContrib = 0, // monthly surplus from budget to distribute to funds
  purchaseLeftover = 0, // leftover cash after down payment + closing costs
  prepaymentBoost = 0, // outside lump sum added to prepay fund at refi time
  seedOrder = [], // custom fund IDs in seed-fill priority order
}) {
  if (!purchaseMonth || !refiDateStr) {
    return { rows: [], balAtRefi: 0, reqRate: null, refiPI: 0, targetPI: targetPayment, prepayDetails: null, allFunds: [], feasible: false, prepayFundBalance: 0, newLoanBalance: 0, reqRateWithPrepay: null, infeasibleWithPrepay: false };
  }

  const monthsToRefi = Math.max(0, monthsBetween(purchaseMonth, refiDateStr));
  const rows = [];

  let mortgageBal = loanAmount;
  let equity = purchasePrice - loanAmount;
  const pi = calcPI(loanAmount, purchaseRate, loanTerm);

  // Build allFunds in priority order — prepay fund has no cap (absorbs all remaining surplus)
  const baseFunds = [
    { id: 'emergency', label: 'Emergency Fund', target: emergencyTarget, balance: 0 },
    { id: 'renov', label: 'Renovation Fund', target: renovTarget, balance: 0 },
    { id: 'prepay', label: 'Prepayment Fund', target: Infinity, balance: 0 },
    ...customFunds.map(f => ({ id: f.id, label: f.label, target: f.target, balance: 0, seed: f.seed || 0 })),
  ];

  // Sort by fundOrder (ids not in fundOrder go to end)
  const allFunds = fundOrder.length > 0
    ? [...baseFunds].sort((a, b) => {
        const ai = fundOrder.indexOf(a.id);
        const bi = fundOrder.indexOf(b.id);
        return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
      })
    : baseFunds;

  // Seed-ordered fund list for phase-1 distribution
  const seedOrderedFunds = seedOrder.length > 0
    ? seedOrder.map(id => allFunds.find(f => f.id === id)).filter(Boolean)
    : allFunds.filter(f => f.id !== 'prepay');

  // Two-phase distribution: phase 1 fills funds to seed amount in seed order,
  // phase 2 fills to full target in fund order. No money is added — it all
  // comes from the surplus being distributed.
  function distribute(amount) {
    let remaining = amount;
    // Phase 1: fill each fund up to its seed amount, in seed priority order
    for (const f of seedOrderedFunds) {
      if (remaining <= 0) break;
      if (!f.seed || f.seed <= 0) continue;
      const seedCap = Math.min(f.seed, f.target === Infinity ? f.seed : f.target);
      const seedSpace = Math.max(0, seedCap - f.balance);
      if (seedSpace > 0) {
        const add = Math.min(seedSpace, remaining);
        f.balance += add;
        remaining -= add;
      }
    }
    // Phase 2: fill to full targets in fund order
    for (const f of allFunds) {
      if (remaining <= 0) break;
      const space = f.target === Infinity ? remaining : Math.max(0, f.target - f.balance);
      if (space > 0) {
        const add = Math.min(space, remaining);
        f.balance += add;
        remaining -= add;
      }
    }
  }

  // Distribute purchase leftover using same two-phase logic
  if (purchaseLeftover > 0) distribute(purchaseLeftover);

  const fundFillMonths = {}; // id → label of month fund first reached target

  for (let i = 0; i <= monthsToRefi; i++) {
    const interestPaid = mortgageBal * (purchaseRate / 100 / 12);
    const principalPaid = Math.max(0, pi - interestPaid);
    mortgageBal = Math.max(0, mortgageBal - principalPaid);
    equity += principalPaid;

    // Distribute monthly surplus using two-phase seed-then-fund-order logic
    if (monthlyFundContrib > 0) distribute(monthlyFundContrib);

    // Track when each capped fund first reaches its target
    for (const f of allFunds) {
      if (!fundFillMonths[f.id] && f.target < Infinity && f.balance >= f.target) {
        fundFillMonths[f.id] = fmtMonthLabel(purchaseMonth, i);
      }
    }

    // Which fund is currently being filled
    let filledFund = null;
    for (const f of allFunds) {
      if (f.balance < f.target) { filledFund = f.label; break; }
    }

    rows.push({
      month: i,
      label: fmtMonthLabel(purchaseMonth, i),
      mortgageBal,
      equity,
      funds: allFunds.map(f => ({ ...f })),
      filledFund,
      principalPaid,
      interestPaid,
    });
  }

  const balAtRefi = mortgageBalance(loanAmount, purchaseRate, loanTerm, monthsToRefi);
  const reqRate = requiredRefinanceRate(balAtRefi, targetPayment, loanTerm);
  const refiPI = calcPI(balAtRefi, refiRate, loanTerm);
  const feasible = refiRate > 0 && refiPI <= targetPayment;

  const prepayDetails = calcPrepayGap({
    balAtRefi, targetPayment, refiRate, loanTerm,
    loanAmount, purchaseRate, monthsToRefi,
  });

  // Prepayment fund reduces loan balance at refi; boost is a lump-sum added at refi time
  const prepayFund = allFunds.find(f => f.id === 'prepay');
  const prepayFundBalance = (prepayFund ? prepayFund.balance : 0) + prepaymentBoost;
  const newLoanBalance = Math.max(0, balAtRefi - prepayFundBalance);
  const minPaymentAt0Pct = loanTerm > 0 ? newLoanBalance / (loanTerm * 12) : 0;
  const infeasibleWithPrepay = newLoanBalance > 0 && targetPayment < minPaymentAt0Pct;
  const reqRateWithPrepay = infeasibleWithPrepay ? null : requiredRefinanceRate(newLoanBalance, targetPayment, loanTerm);

  return { rows, balAtRefi, reqRate, refiPI, targetPI: targetPayment, prepayDetails, feasible, allFunds, prepayFundBalance, newLoanBalance, reqRateWithPrepay, infeasibleWithPrepay, fundFillMonths };
}

// Compute all key metrics for a saved scenario (for gallery tiles + compare)
export function computeScenarioMetrics(scenario) {
  const s1 = scenario?.step1 || {};
  const s2 = scenario?.step2 || {};
  const s3 = scenario?.step3 || {};

  const homePrice = s1.selectedPrice || s2.homePrice || 0;
  const downPct = s1.downPct || s2.downPct || 20;
  const loanAmount = homePrice * (1 - downPct / 100);
  const dp = homePrice * downPct / 100;
  const cc = homePrice * CLOSING_PCT / 100;
  const selectedBalance = s1.selectedBalance || 0;
  const leftover = selectedBalance - dp - cc;

  const piti = s2.piti || s2.pitiData?.total || 0;
  const income = s2.monthlyIncome || 0;
  const expTotal = s2.pitiData?.expTotal || 0;
  const wiggle = s2.wiggles || 0;
  const monthlyReserve = income - piti - expTotal - wiggle;

  // Required refi rate
  const purchaseMonth = s1.selectedPurchaseMonth || s1.startMonth || '';
  const refiDateStr = s3.refiDate || '';
  const monthsToRefi = monthsBetween(purchaseMonth, refiDateStr);
  const balAtRefi = mortgageBalance(loanAmount, s2.mortgageRate || 6.5, s2.loanTerm || 30, Math.max(0, monthsToRefi));
  const reqRefiRate = requiredRefinanceRate(balAtRefi, s3.targetPayment || 0, s2.loanTerm || 30);

  const allFundTargets = [
    ...(s3.emergencyTarget ? [{ id: 'emergency', label: 'Emergency Fund', target: s3.emergencyTarget }] : []),
    ...(s3.renovTarget ? [{ id: 'renov', label: 'Renovation Fund', target: s3.renovTarget }] : []),
    ...(s3.customFunds || []).map(f => ({ id: f.id, label: f.label, target: f.target })),
  ];

  return { homePrice, loanAmount, dp, cc, leftover, piti, income, expTotal, wiggle, monthlyReserve, balAtRefi, reqRefiRate, allFundTargets, downPct };
}

export function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
