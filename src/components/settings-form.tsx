"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SettingsFormProps = {
  initial: {
    maxFileSize: number;
    storageQuotaBytes: number;
    allowedMimeTypes: string[];
    privateLinksOnly: boolean;
  };
};

export function SettingsForm({ initial }: SettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [maxFileSize, setMaxFileSize] = useState(String(initial.maxFileSize));
  const [storageQuotaBytes, setStorageQuotaBytes] = useState(
    String(initial.storageQuotaBytes),
  );
  const [allowedMimeTypes, setAllowedMimeTypes] = useState(
    initial.allowedMimeTypes.join(","),
  );
  const [privateLinksOnly, setPrivateLinksOnly] = useState(initial.privateLinksOnly);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        maxFileSize: Number(maxFileSize),
        storageQuotaBytes: Number(storageQuotaBytes),
        allowedMimeTypes: allowedMimeTypes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        privateLinksOnly,
      }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          value={maxFileSize}
          onChange={(e) => setMaxFileSize(e.target.value)}
          placeholder="Max file size in bytes"
        />
        <Input
          value={storageQuotaBytes}
          onChange={(e) => setStorageQuotaBytes(e.target.value)}
          placeholder="Total storage quota in bytes"
        />
      </div>
      <Input
        value={allowedMimeTypes}
        onChange={(e) => setAllowedMimeTypes(e.target.value)}
        placeholder="image/png,image/jpeg,*/*"
      />
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={privateLinksOnly}
          onChange={(e) => setPrivateLinksOnly(e.target.checked)}
        />
        Private links only
      </label>
      <Button disabled={loading}>
        <Save className="mr-2 h-4 w-4" />
        {loading ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
