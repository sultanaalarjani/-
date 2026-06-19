import fs from "fs";
import path from "path";
import crypto from "crypto";

// ===== الأنواع =====
export type Role = "admin" | "manager";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface Otp {
  email: string;
  code: string;
  expiresAt: number;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: number;
}

export type FieldType = "text" | "number" | "date" | "textarea" | "select";

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[]; // للقوائم المنسدلة
  order: number;
}

export interface Entry {
  id: string;
  userId: string;
  values: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface DBShape {
  users: User[];
  otps: Otp[];
  sessions: Session[];
  fields: FieldDef[];
  entries: Entry[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function defaultDB(): DBShape {
  return { users: [], otps: [], sessions: [], fields: [], entries: [] };
}

export function newId(): string {
  return crypto.randomBytes(9).toString("hex");
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): DBShape {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    const db = defaultDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return db;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DBShape>;
    return { ...defaultDB(), ...parsed };
  } catch {
    return defaultDB();
  }
}

function save(db: DBShape) {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ===== التهيئة: إنشاء مدير الإدارة الأول والحقول الافتراضية =====
let seeded = false;
function seed(db: DBShape): DBShape {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com")
    .trim()
    .toLowerCase();
  const adminName = process.env.ADMIN_NAME || "مدير الإدارة";

  if (!db.users.some((u) => u.email === adminEmail)) {
    db.users.push({
      id: newId(),
      email: adminEmail,
      name: adminName,
      role: "admin",
      active: true,
      createdAt: new Date().toISOString(),
    });
  }

  // حقول افتراضية قابلة للتعديل من اللوحة
  if (db.fields.length === 0) {
    db.fields = [
      { id: newId(), label: "العنوان", type: "text", required: true, order: 1 },
      { id: newId(), label: "التفاصيل", type: "textarea", required: false, order: 2 },
      {
        id: newId(),
        label: "الحالة",
        type: "select",
        required: false,
        options: ["جديد", "قيد التنفيذ", "مكتمل"],
        order: 3,
      },
      { id: newId(), label: "التاريخ", type: "date", required: false, order: 4 },
    ];
  }
  return db;
}

function getDB(): DBShape {
  const db = load();
  if (!seeded) {
    seed(db);
    save(db);
    seeded = true;
  }
  return db;
}

// ===== المستخدمون =====
export function listUsers(): User[] {
  return getDB().users.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getUserById(id: string): User | undefined {
  return getDB().users.find((u) => u.id === id);
}

export function getUserByEmail(email: string): User | undefined {
  return getDB().users.find((u) => u.email === email.trim().toLowerCase());
}

export function createUser(input: {
  email: string;
  name: string;
  role: Role;
}): User {
  const db = getDB();
  const email = input.email.trim().toLowerCase();
  if (db.users.some((u) => u.email === email)) {
    throw new Error("هذا الإيميل مضاف مسبقًا");
  }
  const user: User = {
    id: newId(),
    email,
    name: input.name.trim() || email,
    role: input.role,
    active: true,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  save(db);
  return user;
}

export function setUserActive(id: string, active: boolean) {
  const db = getDB();
  const u = db.users.find((x) => x.id === id);
  if (u) {
    u.active = active;
    save(db);
  }
}

export function deleteUser(id: string) {
  const db = getDB();
  db.users = db.users.filter((u) => u.id !== id);
  db.entries = db.entries.filter((e) => e.userId !== id);
  save(db);
}

// ===== رموز الدخول (OTP) =====
export function setOtp(email: string, code: string, ttlMs: number) {
  const db = getDB();
  const e = email.trim().toLowerCase();
  db.otps = db.otps.filter((o) => o.email !== e);
  db.otps.push({ email: e, code, expiresAt: Date.now() + ttlMs });
  save(db);
}

export function verifyOtp(email: string, code: string): boolean {
  const db = getDB();
  const e = email.trim().toLowerCase();
  const otp = db.otps.find((o) => o.email === e);
  if (!otp) return false;
  const ok = otp.code === code.trim() && otp.expiresAt > Date.now();
  if (ok) {
    db.otps = db.otps.filter((o) => o.email !== e);
    save(db);
  }
  return ok;
}

// ===== الجلسات =====
export function createSession(userId: string, ttlMs: number): string {
  const db = getDB();
  const token = crypto.randomBytes(24).toString("hex");
  db.sessions = db.sessions.filter((s) => s.expiresAt > Date.now());
  db.sessions.push({ token, userId, expiresAt: Date.now() + ttlMs });
  save(db);
  return token;
}

export function getSessionUser(token: string | undefined): User | undefined {
  if (!token) return undefined;
  const db = getDB();
  const s = db.sessions.find((x) => x.token === token);
  if (!s || s.expiresAt < Date.now()) return undefined;
  return db.users.find((u) => u.id === s.userId && u.active);
}

export function destroySession(token: string | undefined) {
  if (!token) return;
  const db = getDB();
  db.sessions = db.sessions.filter((s) => s.token !== token);
  save(db);
}

// ===== الحقول =====
export function listFields(): FieldDef[] {
  return getDB().fields.sort((a, b) => a.order - b.order);
}

export type FieldInput = {
  id?: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
};

export function saveFields(fields: FieldInput[]): FieldDef[] {
  const db = getDB();
  db.fields = fields.map((f, i) => ({
    id: f.id || newId(),
    label: f.label,
    type: f.type,
    required: !!f.required,
    options: f.options,
    order: i + 1,
  }));
  save(db);
  return db.fields;
}

// ===== البيانات (الإدخالات) =====
export function listEntries(): Entry[] {
  return getDB().entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listEntriesByUser(userId: string): Entry[] {
  return listEntries().filter((e) => e.userId === userId);
}

export function getEntry(id: string): Entry | undefined {
  return getDB().entries.find((e) => e.id === id);
}

export function createEntry(userId: string, values: Record<string, string>): Entry {
  const db = getDB();
  const now = new Date().toISOString();
  const entry: Entry = { id: newId(), userId, values, createdAt: now, updatedAt: now };
  db.entries.push(entry);
  save(db);
  return entry;
}

export function updateEntry(id: string, values: Record<string, string>): Entry | undefined {
  const db = getDB();
  const e = db.entries.find((x) => x.id === id);
  if (!e) return undefined;
  e.values = values;
  e.updatedAt = new Date().toISOString();
  save(db);
  return e;
}

export function deleteEntry(id: string) {
  const db = getDB();
  db.entries = db.entries.filter((e) => e.id !== id);
  save(db);
}
