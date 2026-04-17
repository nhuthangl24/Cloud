import { ok, fromError } from "@/lib/http";
import { listFiles } from "@/server/services/file.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const files = await listFiles({
      query: searchParams.get("q"),
      category: searchParams.get("category"),
      sort: searchParams.get("sort"),
      folderId: searchParams.get("folderId"),
      includeDeleted: searchParams.get("deleted") === "true",
    });
    return ok(files);
  } catch (error) {
    return fromError(error);
  }
}
