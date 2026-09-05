import { getLivenessSnapshot } from "@/server/modules/system-health/system-health.service";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getLivenessSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
