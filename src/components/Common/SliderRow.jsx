import { useState, useRef } from 'react';

export default function SliderRow({ label, value, min, max, step, onChange, display, editable, syncValue, syncLabel }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const startEdit = () => {
    if (!editable) return;
    setDraft(String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    const v = parseFloat(draft);
    if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
    setEditing(false);
  };

  const applySync = () => {
    onChange(Math.max(min, Math.min(max, syncValue)));
    setEditing(false);
  };

  return (
    <div className="ar-slider-row">
      <div className="ar-slider-header">
        <span className="ar-label">{label}</span>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <input
              ref={inputRef}
              type="number"
              className="ar-input"
              style={{ width: 110, padding: '2px 8px', fontSize: 14, textAlign: 'right' }}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            />
            {syncValue != null && (
              <button
                type="button"
                className="ar-btn ar-btn-ghost ar-btn-sm"
                style={{ fontSize: 11, padding: '2px 8px' }}
                onMouseDown={e => { e.preventDefault(); applySync(); }}
              >
                {syncLabel || `Use tracked: ${syncValue}`}
              </button>
            )}
          </div>
        ) : (
          <span
            className="ar-num"
            style={{
              fontWeight: 600, fontSize: 14,
              cursor: editable ? 'text' : 'default',
              borderBottom: editable ? '1px dashed var(--ar-muted)' : 'none',
            }}
            title={editable ? 'Click to type a value' : undefined}
            onClick={startEdit}
          >
            {display}
          </span>
        )}
      </div>
      <input type="range" className="ar-slider"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} />
    </div>
  );
}
