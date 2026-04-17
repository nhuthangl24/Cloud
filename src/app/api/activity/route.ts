import { ok, fromError } from "@/lib/http";
import { clearLogs } from "@/server/services/log.service";
import { readStore } from "@/lib/store";

export async function GET() {
  try {
    const store = await readStore();
    return ok(store.activity);
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE() {
  try {
    return ok(await clearLogs());
  } catch (error) {
    return fromError(error);
  }
}
