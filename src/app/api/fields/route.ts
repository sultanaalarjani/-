import { NextResponse } from "next/server";
import { FieldInput, FieldType, listFields, saveFields } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  return NextResponse.json({ fields: listFields() });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  const { fields } = await req.json().catch(() => ({}));
  if (!Array.isArray(fields)) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }
  const allowed: FieldType[] = ["text", "number", "date", "textarea", "select"];
  // تنظيف وتحقق بسيط
  const cleaned: FieldInput[] = fields
    .filter((f: { label?: string }) => f && String(f.label || "").trim())
    .map((f: { id?: string; label: string; type?: string; required?: boolean; options?: string[] }) => ({
      id: f.id || undefined,
      label: String(f.label).trim(),
      type: allowed.includes(f.type as FieldType) ? (f.type as FieldType) : "text",
      required: !!f.required,
      options: Array.isArray(f.options)
        ? f.options.map((o) => String(o).trim()).filter(Boolean)
        : undefined,
    }));
  const saved = saveFields(cleaned);
  return NextResponse.json({ ok: true, fields: saved });
}
