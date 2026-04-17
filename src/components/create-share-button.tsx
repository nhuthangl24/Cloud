"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreateShareButton({ fileId }: { fileId: string }) {
  const [loading, setLoading] = useState(false);

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
      await navigator.clipboard.writeText(payload.data.publicUrl);
      window.alert("Share link copied to clipboard.");
    }
  }

  return (
    <Button
      onClick={onCreate}
      disabled={loading}
      size="icon"
      variant="outline"
      aria-label="Create share link"
      title="Create share link"
    >
      <Link2 className="h-4 w-4" />
    </Button>
  );
}
