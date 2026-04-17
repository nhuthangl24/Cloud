import { destroySession } from "@/lib/auth";
import { fromError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await destroySession();
    return ok({ loggedOut: true });
  } catch (error) {
    return fromError(error);
  }
}
