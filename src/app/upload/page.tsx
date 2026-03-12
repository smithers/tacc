"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/nav";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [patientName, setPatientName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then((r) => {
      if (!r.ok) router.push("/");
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setProgress("Uploading...");

    try {
      const patientRes = await fetch("/api/upload", {
        method: "POST",
        body: (() => {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("patientName", patientName);
          return fd;
        })(),
      });

      let uploadData;
      try {
        uploadData = await patientRes.json();
      } catch {
        throw new Error("Upload failed — server returned an invalid response");
      }
      if (!patientRes.ok) {
        throw new Error(uploadData.error || "Upload failed");
      }
      if (!uploadData.upload?.id) {
        throw new Error("Upload failed — no upload ID returned");
      }

      const { upload } = uploadData;

      // Poll summarization — each call processes one chunk
      let complete = false;
      while (!complete) {
        setProgress("Summarizing...");

        const sumRes = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: upload.id, notes }),
        });

        let sumData;
        try {
          sumData = await sumRes.json();
        } catch {
          throw new Error("Summarization failed — server returned an invalid response. Please try again.");
        }
        if (!sumRes.ok) {
          throw new Error(sumData.error || "Summarization failed");
        }

        if (sumData.status === "complete" && sumData.summary?.id) {
          complete = true;
          router.push(`/results/${sumData.summary.id}`);
        } else if (sumData.status === "processing") {
          setProgress(`Processing chunk ${sumData.chunksComplete} of ${sumData.totalChunks}...`);
          // Wait before next request to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 60000));
        } else if (sumData.status === "complete" && sumData.summaryId) {
          complete = true;
          router.push(`/results/${sumData.summaryId}`);
        } else {
          throw new Error("Unexpected response from server");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f1e7] dark:bg-zinc-950">
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-8 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Upload Discharge Notes
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <input
            type="text"
            placeholder="Patient first AND last name"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            required
            className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />

          {file ? (
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 bg-white px-6 py-10 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-500">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Click to select a PDF file
              </span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          )}

          <textarea
            placeholder="Additional rDVM notes or comments (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />

          {error && <p className="text-sm text-red-500">{error}</p>}
          {progress && <p className="text-sm text-zinc-500">{progress}</p>}

          <button
            type="submit"
            disabled={loading || !file}
            className="rounded-lg bg-black py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-900 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Upload & Summarize"}
          </button>
        </form>
      </main>
    </div>
  );
}
