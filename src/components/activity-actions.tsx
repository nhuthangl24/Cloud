"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ActivityActions() {
  const router = useRouter();

  async function onClear() {
    await fetch("/api/activity", { method: "DELETE" });
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={onClear}>
      <Trash2 className="mr-2 h-4 w-4" />
      Clear Activity
    </Button>
  );
}
