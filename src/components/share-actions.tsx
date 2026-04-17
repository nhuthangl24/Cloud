"use client";

import { useRouter } from "next/navigation";
import { Copy, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareActions({
  shareId,
  url,
}: {
  shareId: string;
  url: string;
}) {
  const router = useRouter();

  async function onCopy() {
    await navigator.clipboard.writeText(url);
  }

  async function onRevoke() {
    await fetch(`/api/share-link/${shareId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onCopy}>
        <Copy className="mr-2 h-4 w-4" />
        Copy
      </Button>
      <Button variant="outline" onClick={onRevoke}>
        <Link2Off className="mr-2 h-4 w-4" />
        Revoke
      </Button>
    </div>
  );
}
