"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteFolderButton({ folderId }: { folderId: string }) {
  const router = useRouter();

  async function onDelete() {
    const response = await fetch(`/api/folders/${folderId}`, {
      method: "DELETE",
    });

    const payload = await response.json();

    if (!payload.success) {
      window.alert(payload.error ?? "Unable to delete folder.");
      return;
    }

    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onDelete}
      aria-label="Delete folder"
      title="Delete folder"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
