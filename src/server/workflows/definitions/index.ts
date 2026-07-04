import "server-only";
import type { WorkflowDefinition } from "../engine";
import { strategyWorkflow } from "./strategy";

/** 工作流注册入口：新增工作流在此登记 */
export function registerAllWorkflows(register: (def: WorkflowDefinition) => void): void {
  register(strategyWorkflow);
}
