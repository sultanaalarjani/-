import { useState } from 'react'

export default function TaskModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    title: '',
    desc: '',
    priority: 'medium',
    status: 'todo',
    due: '',
  })

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    onAdd({ ...form, id: `t${Date.now()}` })
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>إضافة مهمة جديدة</h2>
        <form onSubmit={submit}>
          <div className="field">
            <label>عنوان المهمة</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="مثال: تصميم الصفحة الرئيسية"
            />
          </div>

          <div className="field">
            <label>الوصف</label>
            <textarea
              value={form.desc}
              onChange={(e) => update('desc', e.target.value)}
              placeholder="تفاصيل إضافية عن المهمة..."
            />
          </div>

          <div className="row">
            <div className="field">
              <label>الأولوية</label>
              <select
                value={form.priority}
                onChange={(e) => update('priority', e.target.value)}
              >
                <option value="high">عالية</option>
                <option value="medium">متوسطة</option>
                <option value="low">منخفضة</option>
              </select>
            </div>

            <div className="field">
              <label>الحالة</label>
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
              >
                <option value="todo">قيد الانتظار</option>
                <option value="in-progress">جاري التنفيذ</option>
                <option value="done">مكتملة</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>تاريخ الاستحقاق</label>
            <input
              type="date"
              value={form.due}
              onChange={(e) => update('due', e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              إلغاء
            </button>
            <button type="submit" className="btn">
              إضافة المهمة
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
