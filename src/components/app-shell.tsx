import Link from "next/link";
import {
  BarChart3,
  FolderKanban,
  HardDrive,
  Link2,
  Settings,
  Files,
  ScrollText,
  Send,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { Separator } from "@/components/ui/separator";
import { formatBytes } from "@/lib/utils";

type ShellProps = {
  children: React.ReactNode;
  username: string;
  stats: {
    quotaBytes: number;
    usedBytes: number;
  };
};

const baseNav = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/dashboard/files", label: "My Files", icon: Files },
  { href: "/dashboard/folders", label: "Folders", icon: FolderKanban },
  { href: "/dashboard/shared", label: "Shared Links", icon: Link2 },
  { href: "/dashboard/activity", label: "Activity", icon: ScrollText },
  { href: "/dashboard/telegram", label: "Telegram", icon: Send },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children, username, stats }: ShellProps) {
  const usagePct =
    !Number.isFinite(stats.quotaBytes) || stats.quotaBytes <= 0
      ? 0
      : Math.min(100, (stats.usedBytes / stats.quotaBytes) * 100);

  return (
    <div className="min-h-screen" data-hydrated="true">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/12 p-3 text-primary">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Như Thắng Cloud</div>
              <div className="text-xs text-muted-foreground">{username}</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-4">
          {baseNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-[280px] lg:border-r lg:border-border/60 lg:bg-card/60 lg:backdrop-blur">
        <div className="flex h-screen flex-col overflow-y-auto p-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/12 p-3 text-primary">
                <HardDrive className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Như Thắng Cloud</div>
                <div className="text-xs text-muted-foreground">
                  Telegram storage layer
                </div>
              </div>
            </Link>
            <ThemeToggle />
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-border/70 bg-background/80 p-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                MyCloud Dashboard
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-secondary/70 p-4">
            <div className="flex items-center justify-between text-sm">
              <span>Storage Usage</span>
              <span className="font-medium">
                {usagePct > 0 && usagePct < 1 ? "< 1%" : `${usagePct.toFixed(0)}%`}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${usagePct > 0 ? Math.max(1, usagePct) : 0}%` }}
              />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {formatBytes(stats.usedBytes)} / {formatBytes(stats.quotaBytes)}
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {baseNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Separator className="my-6" />
          <div className="mt-auto space-y-4">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
              ig: nhuthangl24
            </div>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="p-4 md:p-6 lg:ml-[280px] lg:p-8">{children}</main>
    </div>
  );
}
