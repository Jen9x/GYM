export default function StatCard({ title, value, subtitle, icon: Icon, color }) {
  const accentColor = color || 'var(--color-primary)';

  return (
    <div className="stat-card" style={{ '--stat-accent': accentColor }}>
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        {Icon && (
          <div className="stat-card-icon">
            <Icon />
          </div>
        )}
      </div>
      <div className="stat-card-value">{value}</div>
      {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
    </div>
  );
}
