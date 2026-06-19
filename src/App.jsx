import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import StatsCards from './components/StatsCards.jsx'
import Board from './components/Board.jsx'
import TaskModal from './components/TaskModal.jsx'
import { seedTasks } from './data/seed.js'

const STORAGE_KEY = 'task-dashboard-tasks'

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    // ignore malformed storage
  }
  return seedTasks
}

export default function App() {
  const [tasks, setTasks] = useState(loadTasks)
  const [modalOpen, setModalOpen] = useState(false)
  const [active, setActive] = useState('board')

  // Persist to localStorage on every change.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  function addTask(task) {
    setTasks((prev) => [task, ...prev])
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  function moveTask(id, status) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t))
    )
  }

  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  return (
    <div className="app">
      <Sidebar active={active} onChange={setActive} />

      <main className="main">
        <div className="topbar">
          <div>
            <h1>لوحة إدارة المهام</h1>
            <p>تابع مهامك ومشاريعك في مكان واحد</p>
          </div>
          <button className="btn" onClick={() => setModalOpen(true)}>
            <span>＋</span> مهمة جديدة
          </button>
        </div>

        <StatsCards tasks={tasks} />

        <div className="progress-panel">
          <div className="progress-head">
            <h3>نسبة الإنجاز الكلية</h3>
            <span className="pct">{pct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <Board tasks={tasks} onDelete={deleteTask} onMove={moveTask} />
      </main>

      {modalOpen && (
        <TaskModal onClose={() => setModalOpen(false)} onAdd={addTask} />
      )}
    </div>
  )
}
