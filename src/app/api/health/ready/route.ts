import { getReadinessSnapshot } from "@/server/modules/system-health/system-health.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getReadinessSnapshot();
  return Response.json(snapshot, {
    status: snapshot.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
