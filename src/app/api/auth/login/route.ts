import { fail, fromError, ok } from "@/lib/http";
import { createSession, verifyLogin } from "@/lib/auth";

type AttemptRecord = {
  count: number;
  lockedUntil: number;
  firstAttempt: number;
};

const loginAttempts = new Map<string, AttemptRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_MS = 15 * 60 * 1000;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const now = Date.now();

    const record = loginAttempts.get(ip);
    if (record) {
      if (record.lockedUntil > now) {
        const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
        return fail(`Too many failed login attempts. Locked out for ${remainingSec}s.`, 429);
      }
      // Reset if window expired
      if (now - record.firstAttempt > WINDOW_MS) {
        loginAttempts.delete(ip);
      }
    }

    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };

    const username = body.username?.trim() || "";
    const password = body.password || "";

    // Constant artificial delay against timing attacks
    await new Promise((resolve) => setTimeout(resolve, 350));

    if (!verifyLogin(username, password)) {
      const current = loginAttempts.get(ip) || { count: 0, lockedUntil: 0, firstAttempt: now };
      current.count += 1;
      if (current.count >= MAX_ATTEMPTS) {
        current.lockedUntil = now + LOCKOUT_MS;
      }
      loginAttempts.set(ip, current);

      const remaining = Math.max(0, MAX_ATTEMPTS - current.count);
      return fail(
        remaining > 0
          ? `Invalid credentials. (${remaining} attempts remaining)`
          : "Account locked out due to too many failed attempts. Try again in 15 minutes.",
        401,
      );
    }

    // Login successful — clear rate limit
    loginAttempts.delete(ip);
    await createSession();

    return ok({ authenticated: true });
  } catch (error) {
    return fromError(error);
  }
}
