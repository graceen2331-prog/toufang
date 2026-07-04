import { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { subscribeWorkflow, type WorkflowEvent } from "@/server/events/pubsub";

export const dynamic = "force-dynamic";

/**
 * 工作流事件 SSE 流。
 * - 连接即推送当前 run 状态快照（避免错过订阅前的事件）
 * - 之后转发 Redis pub/sub 的实时事件
 * - 15s 心跳；run 到达终态后延迟关闭
 */
export async function GET(
  req: NextRequest,
  routeCtx: { params: Promise<{ id: string }> },
): Promise<Response> {
  let auth;
  try {
    auth = await getAuthContext();
  } catch {
    return new Response("unauthorized", { status: 401 });
  }
  const { id } = await routeCtx.params;

  const run = await prisma.workflowRun.findFirst({
    where: { id, tenantId: auth.orgId },
    select: { id: true, status: true },
  });
  if (!run) return new Response("not found", { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => Promise<void>) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: WorkflowEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller 已关闭
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
          // 已关闭
        }
      };

      // 初始快照
      send({
        type: "run_status",
        run_id: run.id,
        status: run.status,
        at: new Date().toISOString(),
      });
      if (["completed", "failed", "cancelled"].includes(run.status)) {
        close();
        return;
      }

      unsubscribe = await subscribeWorkflow(id, (event) => {
        send(event);
        if (
          event.type === "run_status" &&
          event.status &&
          ["completed", "failed", "cancelled"].includes(event.status)
        ) {
          // 留一点时间给客户端消费最后一条
          setTimeout(close, 500);
        }
      });

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
