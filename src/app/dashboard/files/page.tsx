import { UploadModal } from "@/components/upload-modal";
import { FileTable } from "@/components/file-table";
import { FilesFilters } from "@/components/files-filters";
import { getFolders } from "@/server/services/file.service";
import { listFiles } from "@/server/services/file.service";

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const folders = await getFolders();
  const files = await listFiles({
    query: typeof params.q === "string" ? params.q : null,
    category: typeof params.category === "string" ? params.category : null,
    sort: typeof params.sort === "string" ? params.sort : "newest",
    folderId: typeof params.folderId === "string" ? params.folderId : null,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-semibold">My Files</h1>
          <p className="mt-2 text-muted-foreground">
            Tìm kiếm, lọc, tải xuống hoặc chia sẻ file của bạn.
          </p>
        </div>
        <UploadModal />
      </div>

      <FilesFilters
        folders={folders.map((folder) => ({ id: folder.id, path: folder.path }))}
        initialQuery={typeof params.q === "string" ? params.q : ""}
        initialCategory={typeof params.category === "string" ? params.category : "all"}
        initialSort={typeof params.sort === "string" ? params.sort : "newest"}
        initialFolderId={typeof params.folderId === "string" ? params.folderId : "all"}
      />

      <FileTable files={JSON.parse(JSON.stringify(files))} />
    </div>
  );
}
