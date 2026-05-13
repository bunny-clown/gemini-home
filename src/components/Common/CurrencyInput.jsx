import { useState } from 'react';

export default function CurrencyInput({ value, onChange, className, style, placeholder = '—' }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');

  const hasValue = value != null && value !== '' && value !== 0;
  const displayValue = focused
    ? raw
    : (hasValue ? '$' + Number(value).toLocaleString() : '');

  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      style={style}
      placeholder={placeholder}
      value={displayValue}
      onFocus={() => {
        setRaw(hasValue ? String(value) : '');
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
        const v = parseFloat(raw.replace(/[^0-9.]/g, ''));
        onChange(isNaN(v) ? 0 : v);
      }}
      onChange={e => setRaw(e.target.value.replace(/[^0-9.]/g, ''))}
    />
  );
}
