"use client";

import { Suspense } from "react";
import { Search } from "lucide-react";
import { DocumentList } from "@/features/knowledge/components/document-list";
import { DocumentUploadDialog } from "@/features/knowledge/components/document-upload-dialog";
import { KnowledgeQaPanel } from "@/features/knowledge/components/qa-panel";
import { useKnowledgeDocuments } from "@/features/knowledge/queries";
import { PageHeader } from "@/components/shared/page-header";
import { FilterSelect } from "@/components/shared/filter-select";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { useCursorPagination, useUrlFilters } from "@/lib/list-state";
import { KNOWLEDGE_DOCUMENT_STATUS } from "@/shared/constants/status";

const FILTER_DEFAULTS = { status: "", type: "", q: "" };

export default function KnowledgePage() {
  return (
    <Suspense>
      <KnowledgePageInner />
    </Suspense>
  );
}

function KnowledgePageInner() {
  const { filters, setFilter, reset, isFiltered } = useUrlFilters(FILTER_DEFAULTS);
  const pagination = useCursorPagination();
  const documents = useKnowledgeDocuments({
    status: filters.status || undefined,
    type: filters.type || undefined,
    q: filters.q || undefined,
    cursor: pagination.cursor,
  });
  const items = documents.data?.items ?? [];
  const hasReadyDocuments = items.some((item) => item.status === "ready");
  const hasProcessing = items.some((item) => ["uploaded", "parsing", "chunking", "embedding"].includes(item.status));

  return (
    <div className="space-y-6">
      <PageHeader
        title="知识库"
        description="沉淀品牌资料、研究报告、复盘结论和 SOP，并通过 RAG 提供带引用的问答。"
        actions={<DocumentUploadDialog />}
      />

      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-72">
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            value={filters.q}
            onChange={(event) => {
              setFilter("q", event.target.value);
              pagination.resetPages();
            }}
            placeholder="搜索标题"
          />
        </InputGroup>
        <FilterSelect
          placeholder="状态"
          value={filters.status}
          onChange={(value) => {
            setFilter("status", value);
            pagination.resetPages();
          }}
          options={Object.entries(KNOWLEDGE_DOCUMENT_STATUS.states).map(([value, meta]) => ({
            value,
            label: meta.label,
          }))}
        />
        <FilterSelect
          placeholder="类型"
          value={filters.type}
          onChange={(value) => {
            setFilter("type", value);
            pagination.resetPages();
          }}
          options={[
            { value: "document", label: "普通文档" },
            { value: "research", label: "研究报告" },
            { value: "report", label: "复盘报告" },
            { value: "brief", label: "Brief" },
            { value: "sop", label: "SOP" },
          ]}
        />
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              pagination.resetPages();
            }}
          >
            清除筛选
          </Button>
        )}
      </div>

      {hasProcessing && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          有文档正在解析和向量化，列表会自动刷新。
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <DocumentList
          documents={items}
          isLoading={documents.isLoading}
          isError={documents.isError}
          error={documents.error}
          onRetry={() => documents.refetch()}
          filtered={isFiltered}
          pagination={{
            info: documents.data?.pagination,
            page: pagination.page,
            hasPrev: pagination.hasPrev,
            onNext: () => documents.data?.pagination.next_cursor && pagination.next(documents.data.pagination.next_cursor),
            onPrev: pagination.prev,
          }}
          emptyAction={<DocumentUploadDialog />}
        />
        <KnowledgeQaPanel hasReadyDocuments={hasReadyDocuments} />
      </div>
    </div>
  );
}
