import { fail, fromError, ok } from "@/lib/http";
import { createSession, verifyLogin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };

    const username = body.username?.trim() || "";
    const password = body.password || "";

    await new Promise((resolve) => setTimeout(resolve, 400));

    if (!verifyLogin(username, password)) {
      return fail("Invalid credentials", 401);
    }

    await createSession();
    return ok({ authenticated: true });
  } catch (error) {
    return fromError(error);
  }
}
