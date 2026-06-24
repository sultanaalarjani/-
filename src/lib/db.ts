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
  // القطاعات التي يديرها المدير (للمدراء فقط). مدير الإدارة يرى كل القطاعات.
  sectorIds: string[];
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

export interface Sector {
  id: string;
  name: string;
  order: number;
}

export type IndicatorUnit = "percent" | "number";

export interface Indicator {
  id: string;
  name: string;
  unit: IndicatorUnit;
  active: boolean;
  order: number;
}

export interface Period {
  id: string;
  label: string;
  order: number;
}

// قياس لكل (قطاع × مؤشر × ربع)
export interface Measurement {
  id: string;
  sectorId: string;
  indicatorId: string;
  periodId: string;
  target: number | null;
  actual: number | null;
  updatedBy: string;
  updatedAt: string;
}

export interface Settings {
  goodThreshold: number; // حد التعثر الجزئي (أصفر)
  excellentThreshold: number; // حد "وفق المسار" (أخضر)
}

interface DBShape {
  users: User[];
  otps: Otp[];
  sessions: Session[];
  sectors: Sector[];
  indicators: Indicator[];
  periods: Period[];
  measurements: Measurement[];
  settings: Settings;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function defaultDB(): DBShape {
  return {
    users: [],
    otps: [],
    sessions: [],
    sectors: [],
    indicators: [],
    periods: [],
    measurements: [],
    settings: { goodThreshold: 80, excellentThreshold: 100 },
  };
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

// ===== المؤشرات التسعة الافتراضية =====
const DEFAULT_INDICATORS: { name: string; unit: IndicatorUnit }[] = [
  { name: "نسبة الأجهزة العامة التي يتم قياس خدماتها", unit: "percent" },
  { name: "نسبة الأجهزة ذات الأداء المنخفض التي تم عقد جلسات مراجعة لها", unit: "percent" },
  { name: "نسبة التقارير الممتثلة لمعايير جودة ملاحظات الأداء", unit: "percent" },
  { name: "نسبة قابلية قياس مؤشرات المخرجات الوطنية", unit: "percent" },
  { name: "نسبة قابلية قياس الاستراتيجيات الوطنية المعتمدة من مجلس الوزراء", unit: "percent" },
  { name: "عدد الأجهزة العامة التي تم قياس استراتيجياتها المؤسسية", unit: "number" },
  { name: "نسبة التكليفات المباشرة المكتملة أو على المسار", unit: "percent" },
  {
    name: "نسبة وجودة وفعالية معالجة طلبات التغيير وتحديث سير التقدم للمؤشرات والمبادرات",
    unit: "percent",
  },
  { name: "نسبة إتمام الخطة الفردية للاحتياج التطويري", unit: "percent" },
];

const DEFAULT_SECTORS = [
  "قطاع البنية التحتية",
  "قطاع الخدمات الاجتماعية",
  "قطاع المالي والاقتصادي",
  "قطاع الشؤون الحكومية",
];

const DEFAULT_PERIODS = [
  "الربع الأول 2026",
  "الربع الثاني 2026",
  "الربع الثالث 2026",
  "الربع الرابع 2026",
];

// ===== التهيئة =====
let seeded = false;
function seed(db: DBShape): DBShape {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com")
    .trim()
    .toLowerCase();
  const adminName = process.env.ADMIN_NAME || "مدير إدارة عمليات الأداء";

  if (!db.users.some((u) => u.email === adminEmail)) {
    db.users.push({
      id: newId(),
      email: adminEmail,
      name: adminName,
      role: "admin",
      active: true,
      createdAt: new Date().toISOString(),
      sectorIds: [],
    });
  }
  db.users.forEach((u) => {
    if (!Array.isArray(u.sectorIds)) u.sectorIds = [];
  });

  if (db.sectors.length === 0) {
    db.sectors = DEFAULT_SECTORS.map((name, i) => ({ id: newId(), name, order: i + 1 }));
  }

  if (db.indicators.length === 0) {
    db.indicators = DEFAULT_INDICATORS.map((ind, i) => ({
      id: newId(),
      name: ind.name,
      unit: ind.unit,
      active: true,
      order: i + 1,
    }));
  }

  if (db.periods.length === 0) {
    db.periods = DEFAULT_PERIODS.map((label, i) => ({ id: newId(), label, order: i + 1 }));
  }

  // بيانات تجريبية للعرض فقط (SEED_DEMO=true) — قيم ثابتة بلا عشوائية
  if (process.env.SEED_DEMO === "true" && db.measurements.length === 0) {
    db.sectors.forEach((s, si) =>
      db.indicators.forEach((ind, ii) =>
        db.periods.forEach((p, pi) => {
          const isNum = ind.unit === "number";
          const target = isNum ? 10 : 100;
          // قيمة محققة متنوّعة (تتحسّن عبر الأرباع قليلًا) بدون عشوائية
          const base = isNum ? 10 : 100;
          const variance = ((si * 7 + ii * 13 + pi * 5) % 6) * (isNum ? 1 : 8);
          const actual = Math.max(0, base - variance + pi * (isNum ? 0 : 2));
          db.measurements.push({
            id: newId(),
            sectorId: s.id,
            indicatorId: ind.id,
            periodId: p.id,
            target,
            actual: isNum ? Math.min(actual, 13) : actual,
            updatedBy: "demo",
            updatedAt: new Date().toISOString(),
          });
        })
      )
    );
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
  sectorIds?: string[];
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
    sectorIds: input.role === "manager" ? input.sectorIds || [] : [],
  };
  db.users.push(user);
  save(db);
  return user;
}

export function updateUser(
  id: string,
  patch: { active?: boolean; sectorIds?: string[]; name?: string }
) {
  const db = getDB();
  const u = db.users.find((x) => x.id === id);
  if (!u) return;
  if (typeof patch.active === "boolean") u.active = patch.active;
  if (Array.isArray(patch.sectorIds)) u.sectorIds = patch.sectorIds;
  if (typeof patch.name === "string" && patch.name.trim()) u.name = patch.name.trim();
  save(db);
}

export function deleteUser(id: string) {
  const db = getDB();
  db.users = db.users.filter((u) => u.id !== id);
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

// ===== القطاعات =====
const MAX_SECTORS = 7;

export function listSectors(): Sector[] {
  return getDB().sectors.sort((a, b) => a.order - b.order);
}

export function getSector(id: string): Sector | undefined {
  return getDB().sectors.find((s) => s.id === id);
}

export function createSector(name: string): Sector {
  const db = getDB();
  if (db.sectors.length >= MAX_SECTORS) {
    throw new Error(`الحد الأقصى ${MAX_SECTORS} قطاعات`);
  }
  const sector: Sector = { id: newId(), name: name.trim(), order: db.sectors.length + 1 };
  db.sectors.push(sector);
  save(db);
  return sector;
}

export function updateSector(id: string, name: string) {
  const db = getDB();
  const s = db.sectors.find((x) => x.id === id);
  if (s && name.trim()) {
    s.name = name.trim();
    save(db);
  }
}

export function deleteSector(id: string) {
  const db = getDB();
  db.measurements = db.measurements.filter((m) => m.sectorId !== id);
  db.sectors = db.sectors.filter((s) => s.id !== id);
  db.users.forEach((u) => {
    u.sectorIds = (u.sectorIds || []).filter((sid) => sid !== id);
  });
  save(db);
}

// ===== المؤشرات =====
export type IndicatorInput = {
  id?: string;
  name: string;
  unit: IndicatorUnit;
  active: boolean;
};

export function listIndicators(includeInactive = false): Indicator[] {
  const all = getDB().indicators.sort((a, b) => a.order - b.order);
  return includeInactive ? all : all.filter((i) => i.active);
}

export function saveIndicators(items: IndicatorInput[]): Indicator[] {
  const db = getDB();
  db.indicators = items
    .filter((i) => i.name.trim())
    .map((i, idx) => ({
      id: i.id || newId(),
      name: i.name.trim(),
      unit: i.unit === "number" ? "number" : "percent",
      active: i.active !== false,
      order: idx + 1,
    }));
  const ids = new Set(db.indicators.map((i) => i.id));
  db.measurements = db.measurements.filter((m) => ids.has(m.indicatorId));
  save(db);
  return db.indicators;
}

// ===== الفترات =====
export function listPeriods(): Period[] {
  return getDB().periods.sort((a, b) => a.order - b.order);
}

export function createPeriod(label: string): Period {
  const db = getDB();
  const period: Period = { id: newId(), label: label.trim(), order: db.periods.length + 1 };
  db.periods.push(period);
  save(db);
  return period;
}

export function updatePeriod(id: string, label: string) {
  const db = getDB();
  const p = db.periods.find((x) => x.id === id);
  if (p && label.trim()) {
    p.label = label.trim();
    save(db);
  }
}

export function deletePeriod(id: string) {
  const db = getDB();
  db.periods = db.periods.filter((p) => p.id !== id);
  db.measurements = db.measurements.filter((m) => m.periodId !== id);
  save(db);
}

// ===== القياسات (قطاع × مؤشر × ربع) =====
export function listMeasurements(filter?: {
  sectorId?: string;
  periodId?: string;
  sectorIds?: string[];
}): Measurement[] {
  let list = getDB().measurements;
  if (filter?.sectorId) list = list.filter((m) => m.sectorId === filter.sectorId);
  if (filter?.periodId) list = list.filter((m) => m.periodId === filter.periodId);
  if (filter?.sectorIds) list = list.filter((m) => filter.sectorIds!.includes(m.sectorId));
  return list;
}

// ===== الإعدادات =====
export function getSettings(): Settings {
  const s = getDB().settings;
  return {
    goodThreshold: typeof s?.goodThreshold === "number" ? s.goodThreshold : 80,
    excellentThreshold: typeof s?.excellentThreshold === "number" ? s.excellentThreshold : 100,
  };
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const db = getDB();
  const cur = db.settings || { goodThreshold: 80, excellentThreshold: 100 };
  if (typeof patch.goodThreshold === "number" && patch.goodThreshold >= 0)
    cur.goodThreshold = patch.goodThreshold;
  if (typeof patch.excellentThreshold === "number" && patch.excellentThreshold >= 0)
    cur.excellentThreshold = patch.excellentThreshold;
  db.settings = cur;
  save(db);
  return cur;
}

export function upsertMeasurement(input: {
  sectorId: string;
  indicatorId: string;
  periodId: string;
  target: number | null;
  actual: number | null;
  updatedBy: string;
}): Measurement {
  const db = getDB();
  let m = db.measurements.find(
    (x) =>
      x.sectorId === input.sectorId &&
      x.indicatorId === input.indicatorId &&
      x.periodId === input.periodId
  );
  if (m) {
    m.target = input.target;
    m.actual = input.actual;
    m.updatedBy = input.updatedBy;
    m.updatedAt = new Date().toISOString();
  } else {
    m = {
      id: newId(),
      sectorId: input.sectorId,
      indicatorId: input.indicatorId,
      periodId: input.periodId,
      target: input.target,
      actual: input.actual,
      updatedBy: input.updatedBy,
      updatedAt: new Date().toISOString(),
    };
    db.measurements.push(m);
  }
  save(db);
  return m;
}
