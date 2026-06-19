"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Role = "admin" | "manager";

interface Me {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface FieldDef {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "textarea" | "select";
  required: boolean;
  options?: string[];
  order: number;
}

interface Entry {
  id: string;
  userId: string;
  values: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
  authorEmail?: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function Dashboard({ me }: { me: Me }) {
  const router = useRouter();
  const isAdmin = me.role === "admin";
  const [tab, setTab] = useState<string>(isAdmin ? "data" : "entry");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <div className="topbar">
        <div className="brand">لوحة تحكم الإدارة</div>
        <div className="user">
          <span>
            {me.name}{" "}
            <span className={`badge ${isAdmin ? "badge-admin" : "badge-manager"}`}>
              {isAdmin ? "مدير الإدارة" : "مدير"}
            </span>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            خروج
          </button>
        </div>
      </div>

      <div className="container">
        <div className="tabs">
          {isAdmin && (
            <>
              <button
                className={`tab ${tab === "data" ? "active" : ""}`}
                onClick={() => setTab("data")}
              >
                كل البيانات
              </button>
              <button
                className={`tab ${tab === "users" ? "active" : ""}`}
                onClick={() => setTab("users")}
              >
                المدراء والصلاحيات
              </button>
              <button
                className={`tab ${tab === "fields" ? "active" : ""}`}
                onClick={() => setTab("fields")}
              >
                إعداد الحقول
              </button>
            </>
          )}
          <button
            className={`tab ${tab === "entry" ? "active" : ""}`}
            onClick={() => setTab("entry")}
          >
            إدخال بيانات
          </button>
          {!isAdmin && (
            <button
              className={`tab ${tab === "mine" ? "active" : ""}`}
              onClick={() => setTab("mine")}
            >
              إدخالاتي
            </button>
          )}
        </div>

        {tab === "data" && isAdmin && <AllData me={me} />}
        {tab === "users" && isAdmin && <UsersManager me={me} />}
        {tab === "fields" && isAdmin && <FieldsManager />}
        {tab === "entry" && <EntryForm onSaved={() => setTab(isAdmin ? "data" : "mine")} />}
        {tab === "mine" && !isAdmin && <MyEntries me={me} />}
      </div>
    </>
  );
}

/* ============ نموذج إدخال البيانات ============ */
function EntryForm({ onSaved }: { onSaved: () => void }) {
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/fields")
      .then((r) => r.json())
      .then((d) => setFields(d.fields || []));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || "خطأ");
      else {
        setMsg("تم حفظ البيانات بنجاح ✓");
        setValues({});
        setTimeout(onSaved, 700);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 className="section-title">إدخال بيانات جديدة</h2>
      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}
      {fields.length === 0 ? (
        <p className="empty">لا توجد حقول معدّة بعد. تواصل مع مدير الإدارة.</p>
      ) : (
        <form onSubmit={submit}>
          {fields.map((f) => (
            <FieldInput
              key={f.id}
              field={f}
              value={values[f.id] || ""}
              onChange={(v) => setValues((s) => ({ ...s, [f.id]: v }))}
            />
          ))}
          <button className="btn" disabled={loading}>
            {loading ? "جارٍ الحفظ..." : "حفظ البيانات"}
          </button>
        </form>
      )}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label>
        {field.label}
        {field.required && <span style={{ color: "var(--danger)" }}> *</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea
          rows={3}
          value={value}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "select" ? (
        <select
          value={value}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— اختر —</option>
          {(field.options || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type}
          value={value}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

/* ============ عرض البيانات (جدول) ============ */
function EntriesTable({
  entries,
  fields,
  showAuthor,
  onChanged,
}: {
  entries: Entry[];
  fields: FieldDef[];
  showAuthor: boolean;
  onChanged: () => void;
}) {
  async function remove(id: string) {
    if (!confirm("هل تريد حذف هذا الإدخال؟")) return;
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    onChanged();
  }

  if (entries.length === 0) {
    return <div className="empty">لا توجد بيانات بعد.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            {showAuthor && <th>المُدخِل</th>}
            {fields.map((f) => (
              <th key={f.id}>{f.label}</th>
            ))}
            <th>تاريخ الإدخال</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              {showAuthor && (
                <td>
                  <strong>{e.authorName}</strong>
                  <br />
                  <span className="muted" dir="ltr">
                    {e.authorEmail}
                  </span>
                </td>
              )}
              {fields.map((f) => (
                <td key={f.id}>{e.values[f.id] || "—"}</td>
              ))}
              <td className="muted">{fmtDate(e.createdAt)}</td>
              <td>
                <button className="btn btn-danger btn-sm" onClick={() => remove(e.id)}>
                  حذف
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============ كل البيانات (لمدير الإدارة) ============ */
function AllData({ me }: { me: Me }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [er, fr] = await Promise.all([
      fetch("/api/entries").then((r) => r.json()),
      fetch("/api/fields").then((r) => r.json()),
    ]);
    setEntries(er.entries || []);
    setFields(fr.fields || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // تحديث تلقائي كل 15 ثانية ليرى المدير العام أي بيانات جديدة
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  void me;

  return (
    <div>
      <div className="row" style={{ marginBottom: 16, alignItems: "center" }}>
        <h2 className="section-title" style={{ margin: 0, flex: 1 }}>
          كل البيانات المُدخَلة ({entries.length})
        </h2>
        <button className="btn btn-ghost btn-sm" style={{ flex: 0 }} onClick={load}>
          تحديث
        </button>
      </div>
      {loading ? (
        <div className="empty">جارٍ التحميل...</div>
      ) : (
        <EntriesTable entries={entries} fields={fields} showAuthor onChanged={load} />
      )}
    </div>
  );
}

/* ============ إدخالاتي (للمدير) ============ */
function MyEntries({ me }: { me: Me }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [er, fr] = await Promise.all([
      fetch("/api/entries").then((r) => r.json()),
      fetch("/api/fields").then((r) => r.json()),
    ]);
    setEntries(er.entries || []);
    setFields(fr.fields || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  void me;

  return (
    <div>
      <h2 className="section-title">إدخالاتي ({entries.length})</h2>
      {loading ? (
        <div className="empty">جارٍ التحميل...</div>
      ) : (
        <EntriesTable
          entries={entries}
          fields={fields}
          showAuthor={false}
          onChanged={load}
        />
      )}
    </div>
  );
}

/* ============ إدارة المدراء والصلاحيات ============ */
function UsersManager({ me }: { me: Me }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("manager");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const d = await fetch("/api/users").then((r) => r.json());
    setUsers(d.users || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, role }),
    });
    const data = await res.json();
    if (!res.ok) setErr(data.error || "خطأ");
    else {
      setMsg(`تمت إضافة ${data.user.name} ✓`);
      setEmail("");
      setName("");
      setRole("manager");
      load();
    }
  }

  async function toggleActive(u: UserRow) {
    await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    load();
  }

  async function remove(u: UserRow) {
    if (!confirm(`حذف ${u.name}؟ سيتم حذف بياناته أيضًا.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) alert(data.error || "تعذّر الحذف");
    else load();
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 className="section-title">إضافة مستخدم جديد</h2>
        <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
          أضف إيميل الدوام. المدير = صلاحية إدخال بيانات فقط. مدير الإدارة = صلاحيات
          كاملة.
        </p>
        {err && <div className="alert alert-error">{err}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}
        <form onSubmit={add}>
          <div className="row">
            <div>
              <label>إيميل الدوام</label>
              <input
                type="email"
                value={email}
                dir="ltr"
                style={{ textAlign: "left" }}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label>الاسم</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div style={{ flex: "0 0 160px" }}>
              <label>الصلاحية</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="manager">مدير (إدخال فقط)</option>
                <option value="admin">مدير الإدارة</option>
              </select>
            </div>
            <div style={{ flex: "0 0 auto" }}>
              <button className="btn">إضافة</button>
            </div>
          </div>
        </form>
      </div>

      <h2 className="section-title">المستخدمون ({users.length})</h2>
      <table>
        <thead>
          <tr>
            <th>الاسم</th>
            <th>الإيميل</th>
            <th>الصلاحية</th>
            <th>الحالة</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.name}
                {u.id === me.id && <span className="muted"> (أنت)</span>}
              </td>
              <td dir="ltr" style={{ textAlign: "right" }}>
                {u.email}
              </td>
              <td>
                <span className={`badge ${u.role === "admin" ? "badge-admin" : "badge-manager"}`}>
                  {u.role === "admin" ? "مدير الإدارة" : "مدير"}
                </span>
              </td>
              <td>
                {u.active ? (
                  <span className="badge badge-manager">نشط</span>
                ) : (
                  <span className="badge badge-off">موقوف</span>
                )}
              </td>
              <td>
                {u.id !== me.id && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)}>
                      {u.active ? "إيقاف" : "تفعيل"}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(u)}>
                      حذف
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============ إعداد الحقول ============ */
interface EditableField {
  id: string;
  label: string;
  type: FieldDef["type"];
  required: boolean;
  optionsText: string;
}

function FieldsManager() {
  const [fields, setFields] = useState<EditableField[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/fields")
      .then((r) => r.json())
      .then((d) => {
        setFields(
          (d.fields || []).map((f: FieldDef) => ({
            id: f.id,
            label: f.label,
            type: f.type,
            required: f.required,
            optionsText: (f.options || []).join("، "),
          }))
        );
        setLoading(false);
      });
  }, []);

  function update(i: number, patch: Partial<EditableField>) {
    setFields((s) => s.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function addField() {
    setFields((s) => [
      ...s,
      { id: "", label: "", type: "text", required: false, optionsText: "" },
    ]);
  }
  function removeField(i: number) {
    setFields((s) => s.filter((_, idx) => idx !== i));
  }

  async function save() {
    setMsg("");
    const payload = fields
      .filter((f) => f.label.trim())
      .map((f) => ({
        id: f.id,
        label: f.label.trim(),
        type: f.type,
        required: f.required,
        options:
          f.type === "select"
            ? f.optionsText
                .split(/[،,]/)
                .map((o) => o.trim())
                .filter(Boolean)
            : undefined,
      }));
    const res = await fetch("/api/fields", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: payload }),
    });
    if (res.ok) setMsg("تم حفظ الحقول ✓");
  }

  if (loading) return <div className="empty">جارٍ التحميل...</div>;

  return (
    <div className="card">
      <h2 className="section-title">إعداد الحقول التي يعبّيها المدراء</h2>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        أضف أو احذف أو عدّل الحقول. لنوع &quot;قائمة&quot; اكتب الخيارات مفصولة بفاصلة.
      </p>
      {msg && <div className="alert alert-success">{msg}</div>}

      {fields.map((f, i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <div className="field-row">
            <input
              placeholder="اسم الحقل"
              value={f.label}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <select
              value={f.type}
              onChange={(e) => update(i, { type: e.target.value as FieldDef["type"] })}
              style={{ flex: "0 0 150px" }}
            >
              <option value="text">نص</option>
              <option value="textarea">نص طويل</option>
              <option value="number">رقم</option>
              <option value="date">تاريخ</option>
              <option value="select">قائمة</option>
            </select>
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={f.required}
                onChange={(e) => update(i, { required: e.target.checked })}
              />
              إلزامي
            </label>
            <button
              className="btn btn-danger btn-sm"
              style={{ flex: "0 0 auto" }}
              onClick={() => removeField(i)}
            >
              حذف
            </button>
          </div>
          {f.type === "select" && (
            <input
              placeholder="الخيارات مفصولة بفاصلة، مثال: جديد، قيد التنفيذ، مكتمل"
              value={f.optionsText}
              onChange={(e) => update(i, { optionsText: e.target.value })}
            />
          )}
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={addField}>
          + إضافة حقل
        </button>
        <button className="btn" onClick={save}>
          حفظ الحقول
        </button>
      </div>
    </div>
  );
}
