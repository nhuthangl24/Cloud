"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreateShareButton({ fileId }: { fileId: string }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onCreate() {
    setLoading(true);
    const response = await fetch(`/api/share/${fileId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await response.json();
    setLoading(false);

    if (payload.success && payload.data?.publicUrl) {
      try {
        await navigator.clipboard.writeText(payload.data.publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        window.prompt("Share link created. Press Cmd/Ctrl+C to copy:", payload.data.publicUrl);
      }
    }
  }

  return (
    <div className="relative inline-block">
      <Button
        onClick={onCreate}
        disabled={loading}
        size="icon"
        variant="outline"
        aria-label="Create share link"
        title="Create share link"
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Link2 className="h-4 w-4" />}
      </Button>
      {copied && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-black/80 text-white text-xs rounded shadow-lg z-50 animate-in fade-in zoom-in duration-200">
          Copied!
        </div>
      )}
    </div>
  );
}
