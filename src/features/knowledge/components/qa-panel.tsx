"use client";

import { useState } from "react";
import { MessageSquareText, Send } from "lucide-react";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAskKnowledge, useRagHistory } from "@/features/knowledge/queries";
import type { KnowledgeAnswerDto } from "@/shared/schemas/knowledge";

export function KnowledgeQaPanel({ hasReadyDocuments }: { hasReadyDocuments: boolean }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<KnowledgeAnswerDto | null>(null);
  const ask = useAskKnowledge();
  const history = useRagHistory();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareText className="size-4" />
          知识问答
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasReadyDocuments && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            当前没有就绪文档。文档处理完成后，答案会附带可追溯引用。
          </div>
        )}
        <div className="space-y-2">
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="例如：双十一美妆 Campaign 哪类内容更适合承接转化？"
            rows={4}
          />
          <Button
            disabled={!question.trim() || ask.isPending || !hasReadyDocuments}
            onClick={() =>
              ask.mutate(
                { question, top_k: 5, citation_required: true },
                { onSuccess: (data) => setAnswer(data) },
              )
            }
          >
            <Send className="size-4" />
            提问
          </Button>
        </div>

        {answer && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="whitespace-pre-wrap text-sm leading-6">{answer.answer}</div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">置信度 {(answer.confidence * 100).toFixed(0)}%</Badge>
              {answer.missing_knowledge.length > 0 && <Badge variant="outline">存在知识缺口</Badge>}
            </div>
            {answer.citations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">引用来源</p>
                {answer.citations.map((citation) => (
                  <button
                    key={citation.chunk_id}
                    className="block w-full rounded-md border bg-background p-3 text-left text-sm"
                  >
                    <span className="font-medium">[{citation.index}] {citation.title}</span>
                    <span className="mt-1 block text-muted-foreground">{citation.quote}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <AsyncBoundary
          isLoading={history.isLoading}
          isError={history.isError}
          error={history.error}
          onRetry={() => history.refetch()}
          isEmpty={(history.data ?? []).length === 0}
          emptyTitle="暂无历史提问"
          skeleton={<div className="h-20 rounded-lg bg-muted" />}
        >
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">最近问题</p>
            {(history.data ?? []).slice(0, 4).map((item) => (
              <button
                key={item.id}
                className="block w-full truncate rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => setQuestion(item.query)}
              >
                {item.query}
              </button>
            ))}
          </div>
        </AsyncBoundary>
      </CardContent>
    </Card>
  );
}
