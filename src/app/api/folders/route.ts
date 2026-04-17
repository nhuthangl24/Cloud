import { ok, fromError } from "@/lib/http";
import { createFolderSchema } from "@/lib/validators";
import { createFolder, getFolders } from "@/server/services/file.service";

export async function GET() {
  try {
    return ok(await getFolders());
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createFolderSchema.parse(await request.json());
    return ok(await createFolder(body.name, body.parentId), { status: 201 });
  } catch (error) {
    return fromError(error);
  }
}
