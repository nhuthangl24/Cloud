import { fromError, ok } from "@/lib/http";
import { deleteFolder } from "@/server/services/file.service";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return ok(await deleteFolder(id));
  } catch (error) {
    return fromError(error);
  }
}
