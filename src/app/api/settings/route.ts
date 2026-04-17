import { ok, fromError } from "@/lib/http";
import { settingsSchema } from "@/lib/validators";
import { getSystemSettings, updateSystemSettings } from "@/server/services/settings.service";

export async function GET() {
  try {
    return ok(await getSystemSettings());
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = settingsSchema.parse(await request.json());
    return ok(await updateSystemSettings(body));
  } catch (error) {
    return fromError(error);
  }
}
