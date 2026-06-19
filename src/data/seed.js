// Initial sample tasks used the first time the app runs.
export const COLUMNS = [
  { id: 'todo', title: 'قيد الانتظار', color: '#3b82f6' },
  { id: 'in-progress', title: 'جاري التنفيذ', color: '#f59e0b' },
  { id: 'done', title: 'مكتملة', color: '#22c55e' },
]

export const seedTasks = [
  {
    id: 't1',
    title: 'تصميم واجهة الصفحة الرئيسية',
    desc: 'إنشاء نموذج أولي لواجهة المستخدم على Figma ومراجعته مع الفريق.',
    status: 'in-progress',
    priority: 'high',
    due: '2026-06-25',
  },
  {
    id: 't2',
    title: 'كتابة محتوى صفحة "من نحن"',
    desc: 'صياغة نص تعريفي مختصر عن الشركة وقيمها.',
    status: 'todo',
    priority: 'low',
    due: '2026-06-30',
  },
  {
    id: 't3',
    title: 'إعداد قاعدة البيانات',
    desc: 'تصميم الجداول والعلاقات وربطها بالخادم.',
    status: 'todo',
    priority: 'high',
    due: '2026-06-22',
  },
  {
    id: 't4',
    title: 'مراجعة الكود البرمجي',
    desc: 'مراجعة طلبات الدمج المفتوحة وإغلاقها.',
    status: 'in-progress',
    priority: 'medium',
    due: '2026-06-20',
  },
  {
    id: 't5',
    title: 'إطلاق النسخة التجريبية',
    desc: 'نشر النسخة التجريبية على بيئة الاختبار.',
    status: 'done',
    priority: 'medium',
    due: '2026-06-15',
  },
  {
    id: 't6',
    title: 'إعداد شعار المشروع',
    desc: 'تصميم الشعار بصيغة SVG وألوانه المعتمدة.',
    status: 'done',
    priority: 'low',
    due: '2026-06-10',
  },
]
