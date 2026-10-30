import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const COOKIE_NAME = "ct_session";

type SessionPayload = {
  username: string;
  exp: number;
  nonce: string;
};

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(encodedPayload)
    .digest("base64url");
}

function serializeSession(payload: SessionPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseSession(token: string | undefined | null) {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  if (signPayload(encodedPayload) !== signature) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (payload.username !== env.AUTH_USERNAME) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function timingSafeStringEqual(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function verifyPasswordHash(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = scryptSync(password, salt, 64).toString("hex");
  return timingSafeStringEqual(derived, hash);
}

export function verifyLogin(username: string, password: string) {
  const usernameOk = timingSafeStringEqual(username, env.AUTH_USERNAME);
  if (!usernameOk) return false;

  if (env.AUTH_PASSWORD_HASH) {
    return verifyPasswordHash(password, env.AUTH_PASSWORD_HASH);
  }

  return timingSafeStringEqual(password, env.AUTH_PASSWORD);
}

export async function createSession() {
  const store = await cookies();
  const exp = Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  const token = serializeSession({
    username: env.AUTH_USERNAME,
    exp,
    nonce: randomBytes(12).toString("hex"),
  });

  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(exp),
  });
}

export async function destroySession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function getServerSession() {
  const store = await cookies();
  return parseSession(store.get(COOKIE_NAME)?.value);
}

export async function requireServerSession() {
  const session = await getServerSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireServerSessionOrRedirect() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return session;
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}
