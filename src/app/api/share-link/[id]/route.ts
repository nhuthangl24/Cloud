import { ok, fromError } from "@/lib/http";
import { revokeShareLink } from "@/server/services/file.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return ok(await revokeShareLink(id));
  } catch (error) {
    return fromError(error);
  }
}
