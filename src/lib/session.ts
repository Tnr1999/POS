import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "pos_staff_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-only-insecure-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionCookieValue(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `staff.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionCookieValue(value: string | undefined | null): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [role, expiresStr, sig] = parts;
  if (role !== "staff") return false;

  const payload = `${role}.${expiresStr}`;
  const expectedSig = sign(payload);

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return false;

  const expires = Number(expiresStr);
  if (Number.isNaN(expires) || Date.now() > expires) return false;

  return true;
}

/** For use in Server Components / Server Actions. Throws if not logged in as staff. */
export async function requireStaff(): Promise<void> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  if (!verifySessionCookieValue(value)) {
    throw new Error("Unauthorized: staff login required");
  }
}

export async function isStaff(): Promise<boolean> {
  const store = await cookies();
  return verifySessionCookieValue(store.get(SESSION_COOKIE_NAME)?.value);
}
