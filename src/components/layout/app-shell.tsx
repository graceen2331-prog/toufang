"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LogOut, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { IMPLEMENTED_ROUTES, NAV_GROUPS } from "@/components/layout/nav-config";
import { usePendingApprovalCount } from "@/features/approvals/queries";
import { useLogout, useMe, useSwitchOrg } from "@/features/auth/queries";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { roleHasPermission } from "@/shared/constants/permissions";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useMe();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar permissions={me?.permissions ?? []} loading={isLoading} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-5 py-5 lg:px-7 lg:py-6">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ permissions, loading }: { permissions: string[]; loading: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground max-md:hidden">
      <div className="px-4 py-5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-sidebar-primary text-base font-semibold text-sidebar-primary-foreground shadow-[0_12px_26px_oklch(0.21_0.08_165_/_0.35)]">
            K
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-5">KOL Marketing OS</span>
            <span className="mt-0.5 block text-xs text-sidebar-foreground/55">投放运营智能中台</span>
          </span>
        </Link>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {loading ? (
          <div className="space-y-2 px-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md bg-sidebar-accent" />
            ))}
          </div>
        ) : (
          NAV_GROUPS.map((group, gi) => {
            const items = group.items.filter(
              (item) =>
                IMPLEMENTED_ROUTES.has(item.href) &&
                (!item.permission || roleHasPermission(permissions, item.permission)),
            );
            if (items.length === 0) return null;
            return (
              <div key={gi}>
                {group.title && (
                  <div className="px-2.5 pb-2 text-[11px] font-medium text-sidebar-foreground/45">
                    {group.title}
                  </div>
                )}
                <ul className="space-y-1">
                  {items.map((item) => {
                    const active =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--sidebar-primary)]"
                              : "text-sidebar-foreground/72 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <item.icon className={cn("size-4 shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/45")} />
                          {item.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </nav>
      <div className="border-t border-sidebar-border px-4 py-4 text-xs leading-5 text-sidebar-foreground/45">
        <div className="font-medium text-sidebar-foreground/70">GlowLab 演示空间</div>
        <div>AI 输出与审批门已接入审计链路</div>
      </div>
    </aside>
  );
}

function Topbar() {
  const { data: me } = useMe();
  const logout = useLogout();
  const switchOrg = useSwitchOrg();

  const initials = me?.user.name?.slice(0, 1).toUpperCase() ?? "?";
  const multiOrg = (me?.memberships.length ?? 0) > 1;

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/88 px-5 backdrop-blur-xl lg:px-7">
      <div>
        {me && multiOrg ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 rounded-md border-foreground/10 bg-card/75 gap-1.5 font-medium shadow-sm">
                {me.org?.name}
                <ChevronsUpDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>切换组织</DropdownMenuLabel>
              {me.memberships.map((m) => (
                <DropdownMenuItem
                  key={m.org_id}
                  disabled={m.org_id === me.org?.id}
                  onClick={() => switchOrg.mutate(m.org_id)}
                >
                  {m.org_name}
                  <span className="ml-auto text-xs text-muted-foreground">{m.role_name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-sm font-medium">{me?.org?.name}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {me && roleHasPermission(me.permissions, "approval:read") && <ApprovalsBell />}
        {me && <NotificationBell />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{me?.user.name}</div>
              <div className="text-xs font-normal text-muted-foreground">{me?.user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout.mutate()} variant="destructive">
              <LogOut className="size-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

/** 审批入口：待审批数 > 0 时显示红点数字 */
function ApprovalsBell() {
  const { data } = usePendingApprovalCount();
  const pending = data?.pending ?? 0;

  return (
    <Button variant="ghost" size="icon" className="relative rounded-md" asChild>
      <Link href="/approvals" aria-label="审批中心">
        <ShieldCheck className="size-5" />
        {pending > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
            {pending > 99 ? "99+" : pending}
          </span>
        )}
      </Link>
    </Button>
  );
}
