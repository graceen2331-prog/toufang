"use client";

import { format } from "date-fns";
import { Bot, User, Workflow } from "lucide-react";
import { StatusTag } from "@/components/shared/status-tag";
import type { StateMachine, StatusMeta } from "@/shared/constants/status";

export interface TimelineEvent {
  id: string;
  from_value: string | null;
  to_value: string;
  field: string;
  actor_type: string;
  actor_name?: string | null;
  reason?: string | null;
  created_at: string;
}

const ACTOR_ICONS: Record<string, typeof User> = {
  user: User,
  agent: Bot,
  system: Workflow,
};

/** 状态历史时间线：status_events 的统一渲染 */
export function StatusTimeline({
  events,
  source,
}: {
  events: TimelineEvent[];
  /** 用于渲染状态标签的状态机（多状态字段时传映射表） */
  source: StateMachine | Record<string, StatusMeta>;
}) {
  if (events.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">暂无状态变更记录</p>;
  }
  return (
    <ol className="relative space-y-4 border-l pl-6">
      {events.map((event) => {
        const Icon = ACTOR_ICONS[event.actor_type] ?? User;
        return (
          <li key={event.id} className="relative">
            <span className="absolute -left-[31px] flex size-5 items-center justify-center rounded-full border bg-background">
              <Icon className="size-3 text-muted-foreground" />
            </span>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {event.from_value && (
                <>
                  <StatusTag source={source} value={event.from_value} />
                  <span className="text-muted-foreground">→</span>
                </>
              )}
              <StatusTag source={source} value={event.to_value} />
              <span className="text-xs text-muted-foreground">
                {event.actor_name ?? (event.actor_type === "system" ? "系统" : "AI")}
                {" · "}
                {format(new Date(event.created_at), "yyyy-MM-dd HH:mm")}
              </span>
            </div>
            {event.reason && <p className="mt-1 text-xs text-muted-foreground">{event.reason}</p>}
          </li>
        );
      })}
    </ol>
  );
}
