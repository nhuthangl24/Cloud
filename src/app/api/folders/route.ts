import { ok, fromError } from "@/lib/http";
import { requireServerSession } from "@/lib/auth";
import { createFolderSchema } from "@/lib/validators";
import { createFolder, getFolders } from "@/server/services/file.service";

export async function GET() {
  try {
    await requireServerSession();
    return ok(await getFolders());
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireServerSession();
    const body = createFolderSchema.parse(await request.json());
    return ok(await createFolder(body.name, body.parentId), { status: 201 });
  } catch (error) {
    return fromError(error);
  }
}
