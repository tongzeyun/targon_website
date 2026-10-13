"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JobStatus } from "@/app/[lang]/(workspace)/smart-eye/_components/jobs/job-status";
import { createApiResponseError } from "@/lib/api/api-error";
import { authenticatedFetch } from "@/lib/api/authenticated-fetch";
import { jobsApi } from "@/lib/api/client";
import { CheckCircle, Loader2, Plus, RefreshCw, Search, Sparkles, X, XCircle } from "lucide-react";
import { toast } from "sonner";

interface CandidateItem {
  id: string;
  itemType: "candidate_account" | "candidate_project";
  title: string;
  confidenceScore?: number | null;
  status: "candidate" | "promoted" | "rejected";
  sourceUrl?: string | null;
  sourceName?: string | null;
  createdAt?: string;
}

interface BatchExtractRow {
  url: string;
  jobId: string | null;
  done: boolean;
  status?: string;
  resultJson?: Record<string, unknown> | null;
  errorMessage?: string | null;
  createError?: string;
}

export default function IntelligencePage() {
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>(["vacuum pump tender", "semiconductor equipment procurement"]);
  const [industry, setIndustry] = useState("semiconductor");
  const [searching, setSearching] = useState(false);
  const [searchStats, setSearchStats] = useState<Record<string, unknown> | null>(null);
  const [searchJobId, setSearchJobId] = useState<string | null>(null);
  const [searchPending, setSearchPending] = useState(false);
  const [discoverJobId, setDiscoverJobId] = useState<string | null>(null);
  const [discoverStats, setDiscoverStats] = useState<Record<string, unknown> | null>(null);
  const [enqueueingDiscover, setEnqueueingDiscover] = useState(false);
  const [discoverPending, setDiscoverPending] = useState(false);

  const [urlList, setUrlList] = useState("");
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchRows, setBatchRows] = useState<BatchExtractRow[]>([]);

  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadCandidates = async () => {
    setLoadingCandidates(true);
    try {
      const response = await authenticatedFetch("/api/intelligence?status=candidate", {
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw await createApiResponseError(response, "Failed to load candidates");
      const data = (await response.json()) as { items?: CandidateItem[] };
      setCandidates(data.items || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load candidates");
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadCandidates();
    });
  }, []);

  const addKeyword = () => {
    const value = keywordInput.trim();
    if (value && !keywords.includes(value)) setKeywords([...keywords, value]);
    setKeywordInput("");
  };

  const removeKeyword = (keyword: string) => setKeywords(keywords.filter((item) => item !== keyword));

  const handleDiscoverCompanies = async () => {
    if (keywords.length === 0) return;
    setEnqueueingDiscover(true);
    setDiscoverStats(null);
    setDiscoverJobId(null);
    try {
      const response = await authenticatedFetch("/api/crawler/discover-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, industry }),
      });
      if (!response.ok) throw await createApiResponseError(response, "Failed to enqueue discovery");
      const data = (await response.json()) as { jobId?: string };
      if (!data.jobId) throw new Error("Failed to enqueue discovery");
      setDiscoverJobId(data.jobId);
      setDiscoverPending(true);
      toast.info("Discovery job queued");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submit failed");
    } finally {
      setEnqueueingDiscover(false);
    }
  };

  const handleDiscoverDone = (job: unknown) => {
    const done = job as { status?: string; resultJson?: Record<string, unknown> | null; errorMessage?: string | null };
    if (done.status === "succeeded") {
      setDiscoverStats(done.resultJson || null);
      const count = Number(done.resultJson?.candidateItems ?? done.resultJson?.newAccounts ?? 0);
      if (count > 0) toast.success(`${count} candidate items created`);
      else toast.info("No new companies found");
      loadCandidates();
    } else if (done.status === "failed") {
      toast.error(done.errorMessage || "Discovery failed");
    }
    setDiscoverPending(false);
  };

  const handleSearch = async () => {
    if (keywords.length === 0) return;
    setSearching(true);
    setSearchStats(null);
    setSearchJobId(null);
    try {
      const response = await authenticatedFetch("/api/crawler/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      });
      if (!response.ok) throw await createApiResponseError(response, "Failed to enqueue search");
      const data = (await response.json()) as { jobId?: string };
      if (!data.jobId) throw new Error("Failed to enqueue search");
      setSearchJobId(data.jobId);
      setSearchPending(true);
      toast.info("Search job queued");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submit failed");
    } finally {
      setSearching(false);
    }
  };

  const handleSearchDone = (job: unknown) => {
    const done = job as { status?: string; resultJson?: Record<string, unknown> | null; errorMessage?: string | null };
    if (done.status === "succeeded") {
      setSearchStats(done.resultJson || null);
      const saved = Number(done.resultJson?.saved ?? 0);
      const candidates = Number(done.resultJson?.candidateItems ?? 0);
      toast.success(`${saved} signals saved, ${candidates} candidate projects`);
      loadCandidates();
    } else if (done.status === "failed") {
      toast.error(done.errorMessage || "Search failed");
    }
    setSearchPending(false);
  };

  const handleBatchJobDone = useCallback((jobId: string) => (job: unknown) => {
    const done = job as {
      status?: string;
      resultJson?: Record<string, unknown> | null;
      errorMessage?: string | null;
    };
    setBatchRows((prev) =>
      prev.map((row) =>
        row.jobId === jobId
          ? {
              ...row,
              done: true,
              status: done.status,
              resultJson: done.resultJson ?? null,
              errorMessage: done.errorMessage ?? null,
            }
          : row
      )
    );
  }, []);

  useEffect(() => {
    if (!batchProcessing || batchRows.length === 0) return;
    if (!batchRows.every((row) => row.done)) return;

    queueMicrotask(() => {
      setBatchProcessing(false);
      const succeeded = batchRows.filter((row) => row.status === "succeeded").length;
      toast.success(`${succeeded}/${batchRows.length} processed`);
      if (succeeded > 0) void loadCandidates();
    });
  }, [batchRows, batchProcessing]);

  const handleBatchFetch = async () => {
    const urls = urlList.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("http"));
    if (urls.length === 0) {
      toast.error("Enter at least one URL");
      return;
    }

    setBatchProcessing(true);
    setBatchRows([]);
    const rows: BatchExtractRow[] = [];

    for (const url of urls) {
      try {
        const { jobId } = await jobsApi.create("batch_extract_url", { url });
        rows.push({ url, jobId, done: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create job";
        rows.push({ url, jobId: null, done: true, status: "failed", createError: message });
        toast.error(`${url}: ${message}`);
      }
    }

    setBatchRows(rows);
    setUrlList("");

    if (rows.every((row) => row.done)) {
      setBatchProcessing(false);
      toast.error("No jobs were created");
    }
  };

  const handleCandidateAction = async (id: string, action: "promote" | "reject") => {
    setActingId(id);
    try {
      const response = await authenticatedFetch(`/api/intelligence/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw await createApiResponseError(response, `${action} failed`);
      toast.success(action === "promote" ? "Promoted" : "Rejected");
      loadCandidates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${action} failed`);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-64px)] w-full min-w-0 max-w-5xl space-y-6 px-4 pb-24 pt-24 sm:px-6 lg:px-8 lg:pb-10 lg:pt-[112px]">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Intelligence Intake</h1>
        <p className="text-gray-500 mt-1">Collect signals, review candidates, and promote verified business records.</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2"><Search className="h-5 w-5" /> Search</h2>
            </div>
            <Button variant="outline" size="sm" onClick={loadCandidates} disabled={loadingCandidates} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loadingCandidates ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary" className="gap-1">
                {keyword}
                <button type="button" onClick={() => removeKeyword(keyword)} aria-label={`Remove ${keyword}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Keyword"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addKeyword()}
            />
            <Button variant="outline" onClick={addKeyword} className="gap-2">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSearch} disabled={searching || searchPending || keywords.length === 0} className="gap-2">
              {searching || searchPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Search Tenders
            </Button>
            <Input className="w-full sm:w-44" placeholder="Industry" value={industry} onChange={(event) => setIndustry(event.target.value)} />
            <Button variant="outline" onClick={handleDiscoverCompanies} disabled={enqueueingDiscover || discoverPending || keywords.length === 0} className="gap-2">
              {enqueueingDiscover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Discover Companies
            </Button>
          </div>

          {searchJobId && (
            <div className="rounded-md border p-3">
              <JobStatus jobId={searchJobId} onDone={handleSearchDone} />
            </div>
          )}

          {discoverJobId && (
            <div className="rounded-md border p-3">
              <JobStatus jobId={discoverJobId} onDone={handleDiscoverDone} />
            </div>
          )}

          {(searchStats || discoverStats) && (
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: "Results", value: searchStats?.totalResults ?? discoverStats?.searched ?? 0 },
                { label: "Extracted", value: searchStats?.extracted ?? discoverStats?.found ?? 0 },
                { label: "Signals", value: searchStats?.saved ?? 0 },
                { label: "Candidates", value: searchStats?.candidateItems ?? discoverStats?.candidateItems ?? 0 },
              ].map((stat) => (
                <div key={stat.label} className="rounded-md border p-3">
                  <p className="text-xl font-semibold">{String(stat.value)}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Batch URL Extract</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="One tender/procurement URL per line"
            value={urlList}
            onChange={(event) => setUrlList(event.target.value)}
            rows={4}
            disabled={batchProcessing}
          />
          <Button onClick={handleBatchFetch} disabled={batchProcessing || !urlList.trim()} className="gap-2">
            {batchProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Extract
          </Button>
          {batchRows.length > 0 && (
            <div className="space-y-2">
              {batchRows.map((row, index) => (
                <div key={row.jobId || `${row.url}-${index}`} className="rounded-md border p-3 space-y-1">
                  <p className="text-xs text-gray-500 truncate">{row.url}</p>
                  {row.createError ? (
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <XCircle className="h-3 w-3 shrink-0" />
                      {row.createError}
                    </p>
                  ) : row.jobId ? (
                    <>
                      <JobStatus jobId={row.jobId} onDone={handleBatchJobDone(row.jobId)} />
                      {row.done && row.status === "succeeded" && row.resultJson && (
                        <p className="text-sm text-green-700 flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {(row.resultJson.title as string) || row.url}
                            {row.resultJson.companyName ? ` · ${String(row.resultJson.companyName)}` : ""}
                            {row.resultJson.matchScore != null ? ` · score ${String(row.resultJson.matchScore)}` : ""}
                          </span>
                        </p>
                      )}
                      {row.done && row.status === "failed" && (
                        <p className="text-sm text-red-600 flex items-center gap-2">
                          <XCircle className="h-3 w-3 shrink-0" />
                          {row.errorMessage || "Extract failed"}
                        </p>
                      )}
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Candidate Review</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCandidates ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading candidates
            </div>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-gray-500">No candidate intelligence waiting for review.</p>
          ) : (
            <div className="divide-y">
              {candidates.map((candidate) => (
                <div key={candidate.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={candidate.itemType === "candidate_account" ? "default" : "secondary"}>
                        {candidate.itemType === "candidate_account" ? "Account" : "Project"}
                      </Badge>
                      <span className="font-medium truncate">{candidate.title}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>Confidence {candidate.confidenceScore ?? "-"}</span>
                      <span className="truncate">{candidate.sourceName || candidate.sourceUrl || "No source"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleCandidateAction(candidate.id, "promote")} disabled={actingId === candidate.id} className="gap-2">
                      {actingId === candidate.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      Promote
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCandidateAction(candidate.id, "reject")} disabled={actingId === candidate.id} className="gap-2">
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
