"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/nav";

interface SummaryData {
  id: string;
  content: string;
  createdAt: string;
  upload: {
    id: string;
    filename: string;
    patient: { name: string; ownerName: string };
  };
}

interface UploadFile {
  id: string;
  filename: string;
}

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [allUploads, setAllUploads] = useState<UploadFile[]>([]);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => {
      if (!r.ok) router.push("/");
    });
  }, [router]);

  useEffect(() => {
    fetch(`/api/summaries/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setSummary(data.summary);
        setAllUploads(data.allUploads || []);
      });
  }, [id]);

  async function handleCopy() {
    if (!summary) return;
    await navigator.clipboard.writeText(summary.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    const res = await fetch(`/api/pdf/${id}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `summary-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-[#f5f1e7] dark:bg-zinc-950">
        <Nav />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <p className="text-zinc-500">Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f1e7] dark:bg-zinc-950">
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Summary
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {summary.upload.patient.name}
              {allUploads.length > 0 && " — "}
              {allUploads.map((upload, i) => (
                <span key={upload.id}>
                  {i > 0 && ", "}
                  <a
                    href={`/api/upload/${upload.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    {upload.filename}
                  </a>
                </span>
              ))}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleDownload}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Download PDF
            </button>
          </div>
        </div>

        <div className="whitespace-pre-wrap rounded-xl bg-white p-6 text-sm leading-relaxed text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-300">
          {summary.content}
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Delete this summary
          </button>
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="flex w-80 flex-col gap-4 rounded-2xl bg-white p-6 dark:bg-zinc-900">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                Are you sure you want to delete this summary?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await fetch(`/api/summaries/${id}`, { method: "DELETE" });
                    router.push("/history");
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
