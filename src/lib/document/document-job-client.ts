import { createApiResponseError } from "@/lib/api/api-error";
import { authenticatedFetch } from "@/lib/api/authenticated-fetch";

export interface DocumentJobResult {
  documentId?: string;
  downloadUrl?: string;
  fileName?: string;
}

export interface GeneratedDocumentSummary {
  id: string;
  documentType: string;
  title: string;
  fileName: string;
  fileSize: number;
  status: string;
  createdAt: string;
}

export interface JobWithDocumentResult {
  status?: string;
  errorMessage?: string | null;
  resultJson?: DocumentJobResult | null;
}

export async function createDocumentJob(endpoint: string, payload: Record<string, unknown>): Promise<string> {
  const res = await authenticatedFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, mode: "generate-job" }),
  });
  if (!res.ok) {
    throw await createApiResponseError(res, "Failed to create document job");
  }
  const data = (await res.json().catch(() => ({}))) as { jobId?: unknown };
  if (!data.jobId || typeof data.jobId !== "string") throw new Error("Document job was not created");
  return data.jobId;
}

export async function downloadGeneratedDocument(result: DocumentJobResult): Promise<void> {
  const url = result.downloadUrl || (result.documentId ? `/api/generated-documents/${result.documentId}/download` : "");
  if (!url) throw new Error("Generated document is missing download URL");

  const res = await authenticatedFetch(url);
  if (!res.ok) {
    throw await createApiResponseError(res, "Failed to download generated document");
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = result.fileName || "generated-document.docx";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function downloadDocumentFromJob(job: unknown): Promise<void> {
  const typedJob = job as JobWithDocumentResult;
  if (typedJob.status !== "succeeded") {
    throw new Error(typedJob.errorMessage || "Document job did not complete");
  }
  await downloadGeneratedDocument(typedJob.resultJson || {});
}

export async function listGeneratedDocuments(documentType: string): Promise<GeneratedDocumentSummary[]> {
  const params = new URLSearchParams({ type: documentType });
  const res = await authenticatedFetch(`/api/generated-documents?${params.toString()}`);
  if (!res.ok) {
    throw await createApiResponseError(res, "Failed to load generated documents");
  }
  const data = (await res.json().catch(() => ({}))) as { documents?: unknown };
  return Array.isArray(data.documents) ? (data.documents as GeneratedDocumentSummary[]) : [];
}
