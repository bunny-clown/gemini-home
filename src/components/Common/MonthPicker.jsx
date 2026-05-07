import { MONTH_NAMES } from '../../utils/calculations';

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 14 }, (_, i) => THIS_YEAR - 1 + i);

export default function MonthPicker({ value, onChange, style }) {
  const parts = value ? value.split('-') : [];
  const year  = parts[0] ? parseInt(parts[0], 10) : THIS_YEAR;
  const month = parts[1] ? parseInt(parts[1], 10) : 1;

  function update(newYear, newMonth) {
    onChange(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  }

  return (
    <div style={{ display: 'flex', gap: 8, ...style }}>
      <select
        className="ar-input"
        value={month}
        onChange={e => update(year, Number(e.target.value))}
        style={{ width: 100 }}
      >
        {MONTH_NAMES.map((m, i) => (
          <option key={i} value={i + 1}>{m}</option>
        ))}
      </select>
      <select
        className="ar-input"
        value={year}
        onChange={e => update(Number(e.target.value), month)}
        style={{ width: 100 }}
      >
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
