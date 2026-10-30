import { fromError, ok } from "@/lib/http";
import { requireServerSession } from "@/lib/auth";
import { deleteFolder } from "@/server/services/file.service";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireServerSession();
    const { id } = await context.params;
    return ok(await deleteFolder(id));
  } catch (error) {
    return fromError(error);
  }
}
