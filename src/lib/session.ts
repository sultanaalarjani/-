import { cookies } from "next/headers";
import { getSessionUser, User } from "./db";

export const SESSION_COOKIE = "session_token";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 أيام

export async function getCurrentUser(): Promise<User | undefined> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}
