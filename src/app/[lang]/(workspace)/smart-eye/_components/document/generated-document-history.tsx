"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  downloadGeneratedDocument,
  listGeneratedDocuments,
  type GeneratedDocumentSummary,
} from "@/lib/document/document-job-client";

interface GeneratedDocumentHistoryProps {
  documentType: string;
  title?: string;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function GeneratedDocumentHistory({
  documentType,
  title = "历史生成",
}: GeneratedDocumentHistoryProps) {
  const [documents, setDocuments] = useState<GeneratedDocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      setDocuments(await listGeneratedDocuments(documentType));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [documentType]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDocuments();
    });
  }, [loadDocuments]);

  const download = async (document: GeneratedDocumentSummary) => {
    try {
      await downloadGeneratedDocument({
        documentId: document.id,
        fileName: document.fileName,
      });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <Card className="mb-3 shrink-0">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Button variant="ghost" size="sm" onClick={loadDocuments} disabled={loading} className="h-7 gap-1">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          刷新
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        {documents.length === 0 ? (
          <p className="text-xs text-muted-foreground">{loading ? "加载中..." : "暂无历史生成文件"}</p>
        ) : (
          documents.slice(0, 5).map((document) => (
            <div key={document.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{document.title || document.fileName}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {formatDate(document.createdAt)} · {formatFileSize(document.fileSize)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => download(document)} className="h-7 shrink-0 gap-1">
                <Download className="h-3 w-3" />
                下载
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
