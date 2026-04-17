import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "ct_session";

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signPayload(encodedPayload: string) {
  const secret =
    process.env.AUTH_SECRET || "change-this-auth-secret-in-env-for-production";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload),
  );
  return toBase64Url(new Uint8Array(signature));
}

async function parseSession(token: string | undefined | null) {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  if ((await signPayload(encodedPayload)) !== signature) return null;

  try {
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { username: string; exp: number };
    if (payload.exp < Date.now()) return null;
    if (payload.username !== process.env.AUTH_USERNAME) return null;
    return payload;
  } catch {
    return null;
  }
}

function isProtectedPath(pathname: string) {
  if (pathname.startsWith("/dashboard")) return true;
  if (pathname.startsWith("/api") && !pathname.startsWith("/api/auth")) {
    if (pathname.startsWith("/api/public")) return false;
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await parseSession(request.cookies.get(COOKIE_NAME)?.value);

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*", "/login"],
};
