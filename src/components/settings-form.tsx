"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type SettingsFormProps = {
  initial: {
    maxFileSize: number;
    storageQuotaBytes: number;
    allowedMimeTypes: string[];
    privateLinksOnly: boolean;
    telegramTokens: string[];
    telegramChatId: string;
    chunkSize: number;
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
  const [telegramTokens, setTelegramTokens] = useState(
    initial.telegramTokens.join("\n")
  );
  const [telegramChatId, setTelegramChatId] = useState(initial.telegramChatId);
  const [chunkSizeMB, setChunkSizeMB] = useState(
    String(Math.round(initial.chunkSize / 1024 / 1024))
  );

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
        telegramTokens: telegramTokens
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        telegramChatId: telegramChatId.trim(),
        chunkSize: Math.min(19, Math.max(1, Number(chunkSizeMB))) * 1024 * 1024,
      }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Telegram Bot Tokens (Mỗi dòng 1 token)</label>
        <Textarea
          value={telegramTokens}
          onChange={(e) => setTelegramTokens(e.target.value)}
          placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Telegram Storage Chat ID</label>
        <Input
          value={telegramChatId}
          onChange={(e) => setTelegramChatId(e.target.value)}
          placeholder="-1001234567890"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Chunk Size (MB)
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Tối đa 20 MB — giới hạn cứng của Telegram Bot API
          </span>
        </label>
        <Input
          type="number"
          min={1}
          max={20}
          value={chunkSizeMB}
          onChange={(e) => setChunkSizeMB(e.target.value)}
          placeholder="20"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 pt-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Max File Size (Bytes)</label>
          <Input
            value={maxFileSize}
            onChange={(e) => setMaxFileSize(e.target.value)}
            placeholder="Max file size in bytes"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Storage Quota (Bytes)</label>
          <Input
            value={storageQuotaBytes}
            onChange={(e) => setStorageQuotaBytes(e.target.value)}
            placeholder="Total storage quota in bytes"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Allowed MIME Types</label>
        <Input
          value={allowedMimeTypes}
          onChange={(e) => setAllowedMimeTypes(e.target.value)}
          placeholder="image/png,image/jpeg,*/*"
        />
      </div>
      <label className="flex items-center gap-3 text-sm pt-2">
        <input
          type="checkbox"
          checked={privateLinksOnly}
          onChange={(e) => setPrivateLinksOnly(e.target.checked)}
        />
        Private links only
      </label>
      <Button disabled={loading} className="w-full sm:w-auto mt-4">
        <Save className="mr-2 h-4 w-4" />
        {loading ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
