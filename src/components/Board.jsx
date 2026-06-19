import { useState } from 'react'
import TaskCard from './TaskCard.jsx'
import { COLUMNS } from '../data/seed.js'

export default function Board({ tasks, onDelete, onMove }) {
  const [draggingId, setDraggingId] = useState(null)
  const [overCol, setOverCol] = useState(null)

  function handleDragStart(e, id) {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e, colId) {
    e.preventDefault()
    if (draggingId) onMove(draggingId, colId)
    setDraggingId(null)
    setOverCol(null)
  }

  return (
    <section className="board">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id)
        return (
          <div
            key={col.id}
            className={`column ${overCol === col.id ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setOverCol(col.id)
            }}
            onDragLeave={() => setOverCol(null)}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="column-head">
              <span>
                <span className="col-dot" style={{ background: col.color }} />
                {col.title}
              </span>
              <span className="count">{colTasks.length}</span>
            </div>

            {colTasks.length === 0 ? (
              <div className="empty-col">أفلِت مهمة هنا</div>
            ) : (
              colTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onDelete={onDelete}
                  onDragStart={handleDragStart}
                  dragging={draggingId === task.id}
                />
              ))
            )}
          </div>
        )
      })}
    </section>
  )
}
