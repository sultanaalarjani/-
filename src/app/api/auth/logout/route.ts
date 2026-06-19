import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession } from "@/lib/db";
import { SESSION_COOKIE as COOKIE_NAME } from "@/lib/session";

export async function POST() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
