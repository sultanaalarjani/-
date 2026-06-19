export default function StatsCards({ tasks }) {
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  const inProgress = tasks.filter((t) => t.status === 'in-progress').length
  const todo = tasks.filter((t) => t.status === 'todo').length

  const cards = [
    { label: 'إجمالي المهام', value: total, icon: '📋', bg: 'rgba(99,102,241,0.15)', color: '#a5b4fc' },
    { label: 'قيد الانتظار', value: todo, icon: '⏳', bg: 'rgba(59,130,246,0.15)', color: '#93c5fd' },
    { label: 'جاري التنفيذ', value: inProgress, icon: '🔧', bg: 'rgba(245,158,11,0.15)', color: '#fcd34d' },
    { label: 'مكتملة', value: done, icon: '✅', bg: 'rgba(34,197,94,0.15)', color: '#86efac' },
  ]

  return (
    <section className="stats">
      {cards.map((c) => (
        <div className="stat-card" key={c.label}>
          <div className="icon" style={{ background: c.bg, color: c.color }}>
            {c.icon}
          </div>
          <div className="value">{c.value}</div>
          <div className="label">{c.label}</div>
        </div>
      ))}
    </section>
  )
}
