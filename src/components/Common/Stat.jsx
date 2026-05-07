export default function Stat({ label, value, color }) {
  return (
    <div className="ar-stat">
      <div className="ar-stat-label">{label}</div>
      <div className="ar-stat-value ar-num" style={color ? { color } : {}}>{value}</div>
    </div>
  );
}
