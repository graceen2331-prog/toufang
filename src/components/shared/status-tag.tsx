import { Badge } from "@/components/ui/badge";
import { statusMeta, type StateMachine, type StatusMeta, type StatusTone } from "@/shared/constants/status";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  info: "bg-info/10 text-info border-info/20",
  progress: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/15 text-warning-foreground border-warning/30",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
};

/**
 * 状态标签：所有实体状态的统一渲染出口。
 * 颜色与中文文案来自 shared/constants/status.ts，页面不允许自定义状态色。
 */
export function StatusTag({
  source,
  value,
  className,
}: {
  source: StateMachine | Record<string, StatusMeta>;
  value: string;
  className?: string;
}) {
  const meta = statusMeta(source, value);
  return (
    <Badge variant="outline" className={cn(TONE_CLASSES[meta.tone], className)}>
      {meta.label}
    </Badge>
  );
}
