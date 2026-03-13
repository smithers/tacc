"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/nav";

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [patientName, setPatientName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [promptText, setPromptText] = useState("You are a veterinary cardiologist. Summarize the following discharge notes, highlighting key cardiac findings, medications, and follow-up recommendations.");
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => {
      if (!r.ok) router.push("/");
    });
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.prompt) setPromptText(data.prompt);
      })
      .catch(() => {});
  }, [router]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (selected) {
      setFiles((prev) => [...prev, ...Array.from(selected)]);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;
    setLoading(true);
    setError("");

    try {
      const fd = new FormData();
      files.forEach((file) => fd.append("files", file));
      fd.append("patientName", patientName);

      const patientRes = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      const uploadData = await patientRes.json();
      if (!patientRes.ok) {
        throw new Error(uploadData.error || "Upload failed");
      }

      const { uploadIds } = uploadData;

      const sumRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadIds, notes }),
      });

      const sumData = await sumRes.json();
      if (!sumRes.ok) {
        throw new Error(sumData.error || "Summarization failed");
      }

      router.push(`/results/${sumData.summary.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
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

          {files.length > 0 && (
            <div className="flex flex-col gap-2">
              {files.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-3 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 bg-white px-6 py-10 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-500">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {files.length > 0 ? "Click to add more PDF files" : "Click to select PDF files"}
            </span>
            <input
              key={files.length}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          <div className="relative">
            <textarea
              placeholder="Enter any special instructions/edits to the prompt (Optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowPrompt((prev) => !prev)}
                className="text-xs text-zinc-400 underline hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                View current prompt
              </button>
            </div>
            {showPrompt && (
              <div className="absolute right-0 top-full z-50 mt-1 max-w-md rounded-lg border border-zinc-200 bg-white p-4 text-xs leading-relaxed text-zinc-600 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {promptText}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || files.length === 0}
            className="rounded-lg bg-black py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-900 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Upload & Summarize"}
          </button>
        </form>
      </main>
    </div>
  );
}
