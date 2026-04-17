import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateFolderForm } from "@/components/create-folder-form";
import { Button } from "@/components/ui/button";
import { DeleteFolderButton } from "@/components/delete-folder-button";
import { readStore } from "@/lib/store";
import { getFolders } from "@/server/services/file.service";

export default async function FoldersPage() {
  const [folders, store] = await Promise.all([getFolders(), readStore()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Folders</h1>
        <p className="mt-2 text-muted-foreground">Nested folder structure for better organization.</p>
      </div>
      <CreateFolderForm />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {folders.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="p-8 text-sm text-muted-foreground">
              No folders yet. Create one to organize uploads.
            </CardContent>
          </Card>
        ) : null}
        {folders.map((folder) => (
          <Card key={folder.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle>{folder.name}</CardTitle>
              <DeleteFolderButton folderId={folder.id} />
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div>{folder.path}</div>
              <div>
                Files inside:{" "}
                {store.files.filter((file) => !file.isDeleted && file.folderId === folder.id).length}
              </div>
              <Button asChild variant="outline">
                <Link href={`/dashboard/files?folderId=${folder.id}`}>Open Folder</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
