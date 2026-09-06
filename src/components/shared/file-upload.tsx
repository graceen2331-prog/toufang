"use client";

import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FileUpload({
  accept = ".txt,.md,.markdown,text/plain,text/markdown",
  disabled,
  onText,
}: {
  accept?: string;
  disabled?: boolean;
  onText: (file: { name: string; text: string }) => void;
}) {
  return (
    <Button variant="outline" asChild disabled={disabled}>
      <label className="cursor-pointer">
        <Upload className="size-4" />
        选择文件
        <input
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            onText({ name: file.name, text: await file.text() });
            event.currentTarget.value = "";
          }}
        />
      </label>
    </Button>
  );
}
