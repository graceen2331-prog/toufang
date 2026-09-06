"use client";

import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { FileUpload } from "@/components/shared/file-upload";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateKnowledgeDocument } from "@/features/knowledge/queries";
import type { KnowledgeDocumentCreateInput } from "@/shared/schemas/knowledge";

export function DocumentUploadDialog() {
  const createDocument = useCreateKnowledgeDocument();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<KnowledgeDocumentCreateInput["type"]>("document");
  const [visibility, setVisibility] =
    useState<KnowledgeDocumentCreateInput["visibility"]>("workspace");
  const [content, setContent] = useState("");

  const canSubmit = title.trim() && content.trim();

  return (
    <PermissionGate permission="knowledge:write">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="size-4" />
            上传知识
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>上传知识文档</DialogTitle>
            <DialogDescription>
              支持文本和 Markdown。文件会入队解析、分块和向量化。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <FileUpload
                disabled={createDocument.isPending}
                onText={(file) => {
                  setTitle((current) => current || file.name.replace(/\.[^.]+$/, ""));
                  setContent(file.text);
                }}
              />
              <span className="text-sm text-muted-foreground">
                <FileText className="mr-1 inline size-4" />
                也可以直接粘贴正文
              </span>
            </div>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="文档标题"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                value={type}
                onValueChange={(value) => setType(value as KnowledgeDocumentCreateInput["type"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="document">普通文档</SelectItem>
                  <SelectItem value="research">研究报告</SelectItem>
                  <SelectItem value="report">复盘报告</SelectItem>
                  <SelectItem value="brief">Brief</SelectItem>
                  <SelectItem value="sop">SOP</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={visibility}
                onValueChange={(value) =>
                  setVisibility(value as KnowledgeDocumentCreateInput["visibility"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="可见性" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workspace">全组织可见</SelectItem>
                  <SelectItem value="team">团队可见</SelectItem>
                  <SelectItem value="private">仅自己可见</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="粘贴知识正文、复盘结论、SOP 或研究摘要"
              rows={10}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={!canSubmit || createDocument.isPending}
              onClick={() =>
                createDocument.mutate(
                  { title, content, type, visibility, source_type: "upload" },
                  {
                    onSuccess: () => {
                      setOpen(false);
                      setTitle("");
                      setContent("");
                    },
                  },
                )
              }
            >
              入队摄取
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PermissionGate>
  );
}
