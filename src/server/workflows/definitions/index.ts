import "server-only";
import type { WorkflowDefinition } from "../engine";
import { strategyWorkflow } from "./strategy";
import { researchWorkflow } from "./research";
import { creatorDiscoveryWorkflow } from "./creator-discovery";
import { creatorScoringWorkflow } from "./creator-scoring";
import { briefWorkflow } from "./brief";
import { contentReviewWorkflow } from "./content-review";
import { analyticsWorkflow } from "./analytics";

/** 工作流注册入口：新增工作流在此登记 */
export function registerAllWorkflows(register: (def: WorkflowDefinition) => void): void {
  register(strategyWorkflow);
  register(researchWorkflow);
  register(creatorDiscoveryWorkflow);
  register(creatorScoringWorkflow);
  register(briefWorkflow);
  register(contentReviewWorkflow);
  register(analyticsWorkflow);
}
