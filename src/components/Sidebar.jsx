const NAV = [
  { id: 'board', label: 'لوحة المهام', icon: '🗂️' },
  { id: 'stats', label: 'الإحصائيات', icon: '📊' },
  { id: 'calendar', label: 'التقويم', icon: '📅' },
  { id: 'settings', label: 'الإعدادات', icon: '⚙️' },
]

export default function Sidebar({ active, onChange }) {
  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="dot">✓</span>
        <span>مهامي</span>
      </div>

      {NAV.map((item) => (
        <button
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}

      <div className="sidebar-footer">
        لوحة إدارة المهام • نسخة 1.0
      </div>
    </aside>
  )
}
