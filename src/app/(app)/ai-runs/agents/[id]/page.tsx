"use client";

import { use } from "react";
import { AgentRunDetailPage } from "@/features/agent-monitor/components/agent-run-detail-page";

export default function AgentRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AgentRunDetailPage id={id} />;
}
