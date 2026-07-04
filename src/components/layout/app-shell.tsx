"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LogOut, ShieldCheck, Sparkles } from "lucide-react";
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
    <div className="flex min-h-screen">
      <Sidebar permissions={me?.permissions ?? []} loading={isLoading} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ permissions, loading }: { permissions: string[]; loading: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground max-md:hidden">
      <div className="flex h-14 items-center gap-2 px-4 font-semibold">
        <Sparkles className="size-5 text-sidebar-primary" />
        <span>KOL Marketing OS</span>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="space-y-2 px-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full bg-sidebar-accent" />
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
                  <div className="px-3 pb-1 text-xs font-medium text-sidebar-foreground/50">
                    {group.title}
                  </div>
                )}
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <item.icon className="size-4 shrink-0" />
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
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
      <div>
        {me && multiOrg ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 font-medium">
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
      <div className="flex items-center gap-2">
        {me && roleHasPermission(me.permissions, "approval:read") && <ApprovalsBell />}
        {me && <NotificationBell />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
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
    <Button variant="ghost" size="icon" className="relative" asChild>
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
