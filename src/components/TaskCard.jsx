const PRIORITY_LABEL = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' }

function formatDue(due) {
  if (!due) return null
  const date = new Date(due)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdue = date < today
  const text = date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })
  return { text, overdue }
}

export default function TaskCard({ task, onDelete, onDragStart, dragging }) {
  const due = formatDue(task.due)

  return (
    <article
      className={`task ${dragging ? 'dragging' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
    >
      <div className="task-top">
        <span className="task-title">{task.title}</span>
        <button
          className="task-del"
          title="حذف"
          onClick={() => onDelete(task.id)}
        >
          🗑
        </button>
      </div>

      {task.desc && <p className="task-desc">{task.desc}</p>}

      <div className="task-meta">
        <span className={`badge ${task.priority}`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
        {due && (
          <span className={`due ${due.overdue && task.status !== 'done' ? 'overdue' : ''}`}>
            📅 {due.text}
          </span>
        )}
      </div>
    </article>
  )
}
