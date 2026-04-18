"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2Off, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareActions({
  shareId,
  url,
}: {
  shareId: string;
  url: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Press Cmd/Ctrl+C to copy:", url);
    }
  }

  async function onRevoke() {
    setIsDeleting(true);
    try {
      await fetch(`/api/share-link/${shareId}`, { method: "DELETE" });
      router.refresh();
    } catch {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex gap-2">
      <div className="relative inline-block">
        <Button variant="outline" onClick={onCopy} disabled={isDeleting}>
          {copied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        {copied && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-black/80 text-white text-xs rounded shadow z-50 animate-in fade-in zoom-in duration-200">
            Copied!
          </div>
        )}
      </div>
      <Button variant="outline" onClick={onRevoke} disabled={isDeleting}>
        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2Off className="mr-2 h-4 w-4" />}
        {isDeleting ? "Revoking..." : "Revoke"}
      </Button>
    </div>
  );
}
