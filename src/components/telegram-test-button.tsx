"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TelegramTestButton() {
  const [loading, setLoading] = useState(false);

  async function onTest() {
    setLoading(true);
    const response = await fetch("/api/system/telegram/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await response.json();
    setLoading(false);

    if (payload.success) {
      window.alert(
        `Telegram OK\nrequestedChatId=${payload.data.requestedChatId}\nresolvedChatId=${payload.data.resolvedChatId}\nmessageId=${payload.data.messageId}`,
      );
      return;
    }

    window.alert(`Telegram error: ${payload.error}`);
  }

  return (
    <Button onClick={onTest} disabled={loading}>
      <Send className="mr-2 h-4 w-4" />
      {loading ? "Testing..." : "Test Telegram"}
    </Button>
  );
}
