"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FolderOption = {
  id: string;
  path: string;
};

type FilesFiltersProps = {
  folders: FolderOption[];
  initialQuery: string;
  initialCategory: string;
  initialSort: string;
  initialFolderId: string;
};

export function FilesFilters({
  folders,
  initialQuery,
  initialCategory,
  initialSort,
  initialFolderId,
}: FilesFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);

  function pushParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");

    Object.entries(next).forEach(([key, value]) => {
      if (!value || value === "all") {
        params.delete(key);
        return;
      }

      params.set(key, value);
    });

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pushParams({ q: query.trim() });
  }

  return (
    <form
      onSubmit={handleSearchSubmit}
      className="grid gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 md:grid-cols-[1fr_180px_180px_220px_auto]"
    >
      <Input
        name="q"
        placeholder="Search file, tag or type..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <Select defaultValue={initialCategory} onValueChange={(value) => pushParams({ category: value })}>
        <SelectTrigger>
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          <SelectItem value="image">Images</SelectItem>
          <SelectItem value="video">Videos</SelectItem>
          <SelectItem value="audio">Audio</SelectItem>
          <SelectItem value="document">Documents</SelectItem>
          <SelectItem value="archive">Archives</SelectItem>
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue={initialSort} onValueChange={(value) => pushParams({ sort: value })}>
        <SelectTrigger>
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="name">Name A-Z</SelectItem>
          <SelectItem value="size">Largest</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue={initialFolderId} onValueChange={(value) => pushParams({ folderId: value })}>
        <SelectTrigger>
          <SelectValue placeholder="Folder" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All folders</SelectItem>
          {folders.map((folder) => (
            <SelectItem key={folder.id} value={folder.id}>
              {folder.path}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Applying..." : "Apply"}
      </Button>
    </form>
  );
}
