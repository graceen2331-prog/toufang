import { Suspense } from "react";
import { AgentMonitorPage } from "@/features/agent-monitor/components/agent-monitor-page";

export default function AiRunsPage() {
  return (
    <Suspense>
      <AgentMonitorPage />
    </Suspense>
  );
}
