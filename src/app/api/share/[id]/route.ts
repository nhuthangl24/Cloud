import { ok, fromError } from "@/lib/http";
import { createShareLinkSchema } from "@/lib/validators";
import { createShareLink } from "@/server/services/file.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = createShareLinkSchema.parse(await request.json());
    return ok(
      await createShareLink(id, {
        expiresAt: body.expiresAt ?? null,
        maxDownloads: body.maxDownloads ?? null,
        password: body.password ?? null,
      }),
    );
  } catch (error) {
    return fromError(error);
  }
}
