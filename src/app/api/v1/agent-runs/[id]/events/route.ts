import { NextRequest } from "next/server";
import { getAuthContext, requirePermission } from "@/server/auth/context";
import { subscribeAgent, type AgentEvent } from "@/server/events/pubsub";
import { getAgentRunStatus } from "@/server/modules/agent-monitor/agent-monitor.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  routeCtx: { params: Promise<{ id: string }> },
): Promise<Response> {
  let auth;
  try {
    auth = await getAuthContext();
    requirePermission(auth, "ai:monitor");
  } catch {
    return new Response("unauthorized", { status: 401 });
  }
  const { id } = await routeCtx.params;
  let run;
  try {
    run = await getAgentRunStatus({ orgId: auth.orgId, userId: auth.userId }, id);
  } catch {
    return new Response("not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => Promise<void>) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // 客户端已断开
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        void unsubscribe?.();
        try {
          controller.close();
        } catch {
          // 流已经关闭
        }
      };

      send({ type: "run_status", run_id: run.id, status: run.status, at: new Date().toISOString() });
      if (["completed", "failed"].includes(run.status)) {
        close();
        return;
      }
      unsubscribe = await subscribeAgent(id, (event) => {
        send(event);
        if (event.type === "run_status" && event.status && ["completed", "failed"].includes(event.status)) {
          setTimeout(close, 500);
        }
      });
      // 补查订阅建立后的最新状态，避免极快 Agent 在快照与订阅之间完成而漏事件。
      const latest = await getAgentRunStatus({ orgId: auth.orgId, userId: auth.userId }, id);
      if (latest.status !== run.status) {
        send({
          type: "run_status",
          run_id: id,
          status: latest.status,
          at: new Date().toISOString(),
        });
        if (["completed", "failed"].includes(latest.status)) setTimeout(close, 500);
      }
      heartbeat = setInterval(() => {
        send({ type: "heartbeat", run_id: id, at: new Date().toISOString() });
      }, 15_000);
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      void unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
