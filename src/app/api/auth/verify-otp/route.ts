import { NextResponse } from "next/server";
import { createSession, getUserByPhone, verifyOtp } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/session";

export async function POST(req: Request) {
  const { phone, code } = await req.json().catch(() => ({}));
  const clean = (phone || "").toString().trim();

  const user = getUserByPhone(clean);
  if (!user || !user.active) {
    return NextResponse.json({ error: "رقم غير مصرّح" }, { status: 403 });
  }

  if (!verifyOtp(clean, String(code || ""))) {
    return NextResponse.json({ error: "الرمز غير صحيح أو منتهي" }, { status: 400 });
  }

  const token = createSession(user.id, SESSION_TTL_MS);
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}
