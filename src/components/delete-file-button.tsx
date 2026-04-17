"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteFileButton({
  fileId,
  permanent = true,
}: {
  fileId: string;
  permanent?: boolean;
}) {
  const router = useRouter();

  async function onDelete() {
    await fetch(`/api/files/${fileId}?permanent=${permanent ? "true" : "false"}`, {
      method: "DELETE",
    });
    router.push("/dashboard/files");
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onDelete}
      aria-label={permanent ? "Hard delete file" : "Soft delete file"}
      title={permanent ? "Hard delete file" : "Soft delete file"}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
