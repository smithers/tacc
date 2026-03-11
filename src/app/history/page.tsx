"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/nav";

interface SummaryItem {
  id: string;
  content: string;
  createdAt: string;
  upload: {
    filename: string;
    createdAt: string;
    patient: { name: string; ownerName: string };
  };
}

export default function HistoryPage() {
  const router = useRouter();
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => {
      if (!r.ok) router.push("/");
    });
  }, [router]);

  useEffect(() => {
    fetch("/api/summaries")
      .then((r) => r.json())
      .then((data) => {
        setSummaries(data.summaries || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f1e7] dark:bg-zinc-950">
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-8 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          History
        </h1>

        {loading ? (
          <p className="text-zinc-500">Loading...</p>
        ) : summaries.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400">No summaries yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {summaries.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/results/${s.id}`)}
                className="flex items-center justify-between rounded-xl bg-white p-5 text-left shadow-sm transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {s.upload.patient.name}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {s.upload.filename} — Owner: {s.upload.patient.ownerName}
                  </p>
                </div>
                <span className="text-xs text-zinc-400">
                  {new Date(s.createdAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
