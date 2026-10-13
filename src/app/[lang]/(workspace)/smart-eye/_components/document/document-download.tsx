"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, FileType, Loader2 } from "lucide-react";

interface DocumentDownloadProps {
  onDownload: (format: "docx" | "pdf") => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
}

/** 文档下载按钮组 — Word / PDF 选择 */
export function DocumentDownload({
  onDownload,
  disabled = false,
  loading = false,
}: DocumentDownloadProps) {
  const [downloading, setDownloading] = useState<"docx" | "pdf" | null>(null);

  const handleDownload = async (format: "docx" | "pdf") => {
    setDownloading(format);
    try {
      await onDownload(format);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex gap-3">
      <Button
        onClick={() => handleDownload("docx")}
        disabled={disabled || loading || !!downloading}
        className="gap-2"
      >
        {downloading === "docx" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        下载 Word (.docx)
      </Button>
      <Button
        variant="outline"
        onClick={() => handleDownload("pdf")}
        disabled={disabled || loading || !!downloading}
        className="gap-2"
      >
        {downloading === "pdf" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileType className="h-4 w-4" />
        )}
        下载 PDF (.pdf)
      </Button>
    </div>
  );
}
