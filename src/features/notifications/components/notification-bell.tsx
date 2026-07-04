"use client";

import Link from "next/link";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMarkNotificationsRead, useNotifications, useUnreadNotifications } from "@/features/notifications/queries";

export function NotificationBell() {
  const unread = useUnreadNotifications();
  const notifications = useNotifications({ unread: true });
  const markRead = useMarkNotificationsRead();
  const count = unread.data?.unread ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="通知">
          <BellRing className="size-5" />
          {count > 0 && (
            <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          未读通知
          {count > 0 && (
            <button
              className="text-xs font-normal text-muted-foreground hover:text-foreground"
              onClick={() => markRead.mutate({ all: true })}
            >
              全部已读
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(notifications.data?.items ?? []).length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">暂无未读通知</div>
        ) : (
          (notifications.data?.items ?? []).slice(0, 5).map((item) => (
            <DropdownMenuItem key={item.id} asChild>
              <Link
                href={item.link_url ?? "/notifications"}
                className="flex flex-col items-start gap-1 whitespace-normal"
                onClick={() => markRead.mutate({ ids: [item.id] })}
              >
                <span className="font-medium">{item.title}</span>
                {item.body && <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>}
              </Link>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notifications">查看全部通知</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
