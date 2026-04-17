import { ok, fromError } from "@/lib/http";
import { fileUpdateSchema } from "@/lib/validators";
import { getFileById, hardDeleteFile, softDeleteFile, updateFile } from "@/server/services/file.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const file = await getFileById(id);
    return ok(file);
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = fileUpdateSchema.parse(await request.json());
    const updated = await updateFile(id, body);
    return ok(updated);
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get("permanent") === "true";
    const file = await getFileById(id);

    if (permanent) {
      await hardDeleteFile(file);
      return ok({ deleted: true, permanent: true });
    }

    const deleted = await softDeleteFile(file);
    return ok({ deleted, permanent: false });
  } catch (error) {
    return fromError(error);
  }
}
