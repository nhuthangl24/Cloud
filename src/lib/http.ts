import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, details },
    { status },
  );
}

export function fromError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if (error.message === "FORBIDDEN") return fail("Forbidden", 403);
    if (error.message === "NOT_FOUND") return fail("Not found", 404);
    return fail(error.message, 400);
  }

  return fail("Unexpected error", 500);
}
