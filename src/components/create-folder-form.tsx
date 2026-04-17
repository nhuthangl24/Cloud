"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateFolderForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 md:flex-row">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New folder name"
      />
      <Button disabled={loading || !name.trim()}>
        <FolderPlus className="mr-2 h-4 w-4" />
        {loading ? "Creating..." : "Create Folder"}
      </Button>
    </form>
  );
}
