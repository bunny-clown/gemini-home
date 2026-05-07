import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalHeader from '../Common/GlobalHeader';
import { useApp } from '../../contexts/AppContext';
import { buildSavingsTimeline, fmtCurrency, monthsBetween } from '../../utils/calculations';


/* ─── KPI card ─────────────────────────────────────────────────────────── */
function KPICard({ label, value, color }) {
  return (
    <div className="ar-card ar-card-sm">
      <div className="ar-label">{label}</div>
      <div
        className="ar-display ar-num"
        style={{ fontSize: 28, marginTop: 6, color: color || 'var(--ar-fg)' }}
      >
        {value}
      </div>
    </div>
  );
}

/* ─── SVG mini chart ────────────────────────────────────────────────────── */
function MiniChart({ data, width = 600, height = 180, buyAtMonth }) {
  const [popup, setPopup] = useState(null); // index

  if (!data || data.length < 2) return null;

  const projected = data.map(d => d.projected).filter(v => v != null);
  const actual    = data.map(d => d.actual).filter(v => v != null);
  const allVals   = [...projected, ...actual];
  const minVal    = Math.min(...allVals) * 0.95;
  const maxVal    = Math.max(...allVals) * 1.05;
  const range     = maxVal - minVal || 1;

  const padB = 24; // room for x-axis labels
  const pad = { l: 20, r: 20, t: 12, b: padB };
  const W   = width  - pad.l - pad.r;
  const H   = height - pad.t - pad.b;

  const px = i => pad.l + (i / (data.length - 1)) * W;
  const py = v => pad.t + H - ((v - minVal) / range) * H;

  const projPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(d.projected).toFixed(1)}`)
    .join(' ');

  const projArea =
    `${projPath} L ${px(data.length - 1).toFixed(1)} ${(pad.t + H).toFixed(1)} L ${px(0).toFixed(1)} ${(pad.t + H).toFixed(1)} Z`;

  const actualPoints = data
    .map((d, i) => (d.actual != null ? { x: px(i), y: py(d.actual), i } : null))
    .filter(Boolean);

  const actualPath = actualPoints
    .map((pt, j) => `${j === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  // X-axis label every ~5 points
  const labelStep = Math.max(1, Math.round(data.length / 6));
  const labelIdxs = [];
  for (let i = 0; i < data.length; i += labelStep) labelIdxs.push(i);
  if (labelIdxs[labelIdxs.length - 1] !== data.length - 1) labelIdxs.push(data.length - 1);

  const popupRow = popup != null ? data[popup] : null;
  const tooltipX = popup != null ? Math.min(Math.max(px(popup), 50), width - 140) : 0;
  const tooltipY = popup != null ? Math.max(8, py(popupRow.projected) - 60) : 0;

  return (
    <div style={{ position: 'relative' }}>
      <div className="ar-track-chart-scroll">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', cursor: 'pointer' }}
        onMouseLeave={() => setPopup(null)}>
        <defs>
          <linearGradient id="tpProjGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--ar-accent)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--ar-accent)" stopOpacity="0"    />
          </linearGradient>
        </defs>

        {/* Projected area fill */}
        <path d={projArea} fill="url(#tpProjGrad)" />

        {/* Projected dashed line */}
        <path d={projPath} fill="none" stroke="var(--ar-accent)" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.65} />

        {/* Actual solid line */}
        {actualPath && <path d={actualPath} fill="none" stroke="var(--ar-pos)" strokeWidth={2.5} />}

        {/* Clickable projected points */}
        {data.map((d, i) => (
          <g key={i}
            onClick={() => setPopup(popup === i ? null : i)}
            onMouseEnter={() => setPopup(i)}
            onTouchStart={() => setPopup(i)}
          >
            <circle cx={px(i)} cy={py(d.projected)} r={12} fill="transparent" />
            <circle cx={px(i)} cy={py(d.projected)} r={popup === i ? 5 : 3}
              fill={popup === i ? 'var(--ar-accent)' : 'var(--ar-accent)'}
              opacity={popup === i ? 1 : 0.35} />
          </g>
        ))}

        {/* Actual dots */}
        {actualPoints.map(pt => (
          <circle key={pt.i} cx={pt.x} cy={pt.y} r={4} fill="var(--ar-pos)" />
        ))}

        {/* Purchase month marker */}
        {buyAtMonth != null && buyAtMonth < data.length && (
          <g>
            <line
              x1={px(buyAtMonth)} y1={pad.t + 15}
              x2={px(buyAtMonth)} y2={pad.t + H}
              stroke="var(--ar-warn)" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8}
            />
            <rect
              x={px(buyAtMonth) - 24} y={pad.t - 1}
              width={48} height={14} rx={4}
              fill="var(--ar-warn)" opacity={0.15}
            />
            <text x={px(buyAtMonth)} y={pad.t + 10} textAnchor="middle"
              fontSize="8" fontWeight="700" fill="var(--ar-warn)" style={{ userSelect: 'none' }}>
              PURCHASE
            </text>
          </g>
        )}

        {/* X-axis month labels */}
        {labelIdxs.map(i => (
          <text key={i} x={px(i)} y={height - 4} textAnchor="middle"
            fontSize="9" fill="var(--ar-muted)" style={{ userSelect: 'none' }}>
            {data[i].name}
          </text>
        ))}

        {/* Popup tooltip inside SVG */}
        {popupRow && (
          <g>
            <rect x={tooltipX - 4} y={tooltipY - 2} width={148} height={52}
              rx={6} fill="var(--ar-bg)" stroke="var(--ar-border)" strokeWidth={1} />
            <text x={tooltipX} y={tooltipY + 12} fontSize="10" fontWeight="700" fill="var(--ar-fg)">
              {popupRow.name}
            </text>
            <text x={tooltipX} y={tooltipY + 26} fontSize="10" fill="var(--ar-muted)">
              {`Target: ${fmtCurrency(popupRow.projected)}`}
            </text>
            {popupRow.actual != null && (
              <text x={tooltipX} y={tooltipY + 40} fontSize="10" fill="var(--ar-pos)">
                {`Actual: ${fmtCurrency(popupRow.actual)}`}
              </text>
            )}
          </g>
        )}
      </svg>
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */
export default function TrackProgress() {
  const navigate   = useNavigate();
  const { scenarios, targetId, progress, updateProgress } = useApp();

  const [selectedId, setSelectedId] = useState(
    targetId || (scenarios[0]?.id ?? '')
  );

  const scenario = scenarios.find(s => s.id === selectedId);
  const s1       = useMemo(() => scenario?.step1 || {}, [scenario]);

  /* Build projection timeline */
  const timeline = useMemo(() => {
    if (!scenario) return [];
    return buildSavingsTimeline(
      s1.initialSavings     || 0,
      s1.startMonth         || new Date().toISOString().slice(0, 7),
      s1.monthlyContrib     || 0,
      s1.projectionMonths   || 36,
      s1.overrides          || {}
    );
  }, [scenario, s1]);

  const actualByMonth = progress?.[selectedId] || {};

  const [showPast, setShowPast] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const currentRowRef = useRef(null);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const startMonth = s1.startMonth || todayStr;
  const currentMonthIdx = Math.max(0, Math.min(monthsBetween(startMonth, todayStr), timeline.length - 1));

  function scrollToToday() {
    setShowAllMonths(true);
    setTimeout(() => {
      currentRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  /* Chart data */
  const chartData = timeline.map(row => ({
    name:      row.label,
    projected: Math.round(row.balance),
    actual:    actualByMonth[row.month] !== undefined ? actualByMonth[row.month] : null,
  }));

  /* KPI computation — "YTD" = latest month where actual was entered */
  const enteredMonths = Object.keys(actualByMonth).map(Number).sort((a, b) => a - b);
  const latestIdx     = enteredMonths.length > 0 ? enteredMonths[enteredMonths.length - 1] : -1;
  const savedYTD      = latestIdx >= 0 ? (actualByMonth[latestIdx] || 0) : 0;
  const targetYTD     = latestIdx >= 0 && timeline[latestIdx] ? timeline[latestIdx].balance : 0;
  const delta         = savedYTD - targetYTD;
  const onTrack       = delta >= 0;

  /* ── Empty state ──────────────────────────────────────────────────────── */
  if (!scenario) {
    return (
      <>
        <GlobalHeader />
        <div className="ar-scroll">
          <div className="ar-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div className="ar-label">Tracking</div>
              <h1 className="ar-display" style={{ fontSize: 44, fontWeight: 400, margin: '6px 0 0' }}>
                Actual vs target
              </h1>
            </div>
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <h2 className="ar-display" style={{ fontSize: 28, fontWeight: 400, margin: '0 0 8px' }}>
                No scenarios yet
              </h2>
              <p style={{ color: 'var(--ar-muted)', marginBottom: 24 }}>
                Create a scenario to start tracking your savings progress.
              </p>
              <button className="ar-btn ar-btn-accent" onClick={() => navigate('/calculator')}>
                Create a scenario
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Main view ────────────────────────────────────────────────────────── */
  return (
    <>
      <GlobalHeader />
      <div className="ar-scroll">
        <div className="ar-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Page header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="ar-label">Tracking</div>
              <h1 className="ar-display ar-track-title" style={{ fontSize: 44, fontWeight: 400, margin: '6px 0 0' }}>
                Actual vs target
              </h1>
            </div>

            {/* Scenario selector */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <div className="ar-label" style={{ fontSize: 10, letterSpacing: '0.12em' }}>COMPARING AGAINST</div>
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="ar-input"
                style={{ width: 220, fontSize: 14, fontWeight: 500 }}
              >
                {scenarios.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name || 'Unnamed'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4 KPI summary cards */}
          <div className="ar-grid-4 ar-track-kpi">
            <KPICard
              label="Saved YTD"
              value={fmtCurrency(savedYTD)}
            />
            <KPICard
              label="Target YTD"
              value={fmtCurrency(targetYTD)}
            />
            <KPICard
              label="Delta"
              value={(delta >= 0 ? '+' : '') + fmtCurrency(delta)}
              color={delta >= 0 ? 'var(--ar-pos)' : 'var(--ar-warn)'}
            />
            <KPICard
              label="Status"
              value={onTrack ? 'On track' : 'Behind'}
              color={onTrack ? 'var(--ar-pos)' : 'var(--ar-warn)'}
            />
          </div>

          {/* SVG chart card */}
          <div className="ar-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div className="ar-label">Projected vs actual savings</div>
              <div className="ar-track-legend" style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--ar-muted)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="20" height="10">
                    <line
                      x1="0" y1="5" x2="20" y2="5"
                      stroke="var(--ar-accent)"
                      strokeWidth="1.5"
                      strokeDasharray="5 3"
                      opacity="0.65"
                    />
                  </svg>
                  Projected
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="20" height="10">
                    <line x1="0" y1="5" x2="20" y2="5" stroke="var(--ar-pos)" strokeWidth="2.5" />
                  </svg>
                  Actual
                </span>
                {s1.buyAtMonth != null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="20" height="10">
                      <line x1="10" y1="0" x2="10" y2="10" stroke="var(--ar-warn)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8" />
                    </svg>
                    Purchase
                  </span>
                )}
              </div>
            </div>
            <div className="ar-track-chart-wrap">
              <MiniChart data={chartData} buyAtMonth={s1.buyAtMonth ?? null} />
            </div>
          </div>

          {/* Monthly entries table */}
          <div className="ar-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div className="ar-label">Monthly entries</div>
              <div className="ar-track-actions" style={{ display: 'flex', gap: 8 }}>
                {currentMonthIdx > 0 && (
                  <button className="ar-btn ar-btn-ghost ar-btn-sm ar-track-showpast" onClick={() => setShowPast(p => !p)}>
                    {showPast ? 'Hide past months' : `Show ${currentMonthIdx} past month${currentMonthIdx !== 1 ? 's' : ''}`}
                  </button>
                )}
                <button
                  className={`ar-btn ar-btn-sm ar-track-expand ${showAllMonths ? 'ar-btn-accent' : 'ar-btn-ghost'}`}
                  onClick={() => setShowAllMonths(v => !v)}
                >
                  {showAllMonths ? '↑ Collapse to last 6' : `↓ Expand all ${timeline.length} months`}
                </button>
                <button className="ar-btn ar-btn-ghost ar-btn-sm" onClick={scrollToToday}>
                  Jump to today
                </button>
              </div>
            </div>
            <div className={`ar-track-table-wrap ${showAllMonths ? 'show-all' : ''} ${showPast ? 'show-past' : ''}`}>
              <table className="ar-table ar-track-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th style={{ textAlign: 'right' }}>Target</th>
                    <th style={{ textAlign: 'right' }}>Actual</th>
                    <th style={{ textAlign: 'right' }}>&#916;</th>
                    <th style={{ minWidth: 120 }}>Hit rate</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map(row => {
                    const isPast    = row.month < currentMonthIdx;
                    const isCurrent = row.month === currentMonthIdx;
                    const isInMobileWindow = row.month >= Math.max(0, currentMonthIdx - 5) && row.month <= currentMonthIdx;

                    const projected = Math.round(row.balance);
                    const actual    = actualByMonth[row.month];
                    const rowDelta  = actual !== undefined ? actual - projected : null;
                    const hitRate   =
                      actual !== undefined
                        ? Math.min(100, (actual / Math.max(projected, 1)) * 100)
                        : null;

                    return (
                      <tr
                        key={row.month}
                        ref={isCurrent ? currentRowRef : null}
                        data-is-past={isPast}
                        data-is-current={isCurrent}
                        data-in-mobile-window={isInMobileWindow}
                        className={isCurrent ? 'ar-track-current' : ''}
                        style={isCurrent ? { background: 'var(--ar-accent-soft)' } : {}}
                      >
                        {/* Month */}
                        <td style={{ whiteSpace: 'nowrap' }}>{row.label}</td>

                        {/* Target (cumulative) */}
                        <td style={{ textAlign: 'right' }} className="ar-num">
                          {fmtCurrency(projected)}
                        </td>

                        {/* Actual input */}
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            placeholder="—"
                            value={actual !== undefined ? actual : ''}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '') {
                                updateProgress && updateProgress(selectedId, row.month, 0);
                              } else {
                                updateProgress && updateProgress(selectedId, row.month, parseFloat(val) || 0);
                              }
                            }}
                            className="ar-input ar-num ar-track-input"
                          />
                        </td>

                        {/* Delta */}
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 500,
                            color:
                              rowDelta == null
                                ? 'var(--ar-muted)'
                                : rowDelta >= 0
                                ? 'var(--ar-pos)'
                                : 'var(--ar-warn)',
                          }}
                          className="ar-num"
                        >
                          {rowDelta != null
                            ? `${rowDelta >= 0 ? '+' : ''}${fmtCurrency(rowDelta)}`
                            : '—'}
                        </td>

                        {/* Hit rate bar */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {hitRate !== null ? (
                              <div
                                style={{
                                  flex: 1,
                                  height: 6,
                                  borderRadius: 3,
                                  background: 'rgba(0,0,0,0.06)',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${hitRate}%`,
                                    background: rowDelta >= 0 ? 'var(--ar-pos)' : 'var(--ar-warn)',
                                    borderRadius: 3,
                                    transition: 'width 0.3s',
                                  }}
                                />
                              </div>
                            ) : (
                              <div style={{ flex: 1 }} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
