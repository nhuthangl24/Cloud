"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteFileButton({
  fileId,
  permanent = true,
}: {
  fileId: string;
  permanent?: boolean;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function onDelete() {
    setIsDeleting(true);
    try {
      await fetch(`/api/files/${fileId}?permanent=${permanent ? "true" : "false"}`, {
        method: "DELETE",
      });
      router.push("/dashboard/files");
      router.refresh();
    } catch {
      setIsDeleting(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onDelete}
      disabled={isDeleting}
      aria-label={permanent ? "Hard delete file" : "Soft delete file"}
      title={permanent ? "Hard delete file" : "Soft delete file"}
    >
      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}
