"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/nav";

export default function SettingsPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => {
      if (!r.ok) router.push("/");
    });
  }, [router]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setPrompt(data.prompt);
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-screen bg-[#f5f1e7] dark:bg-zinc-950">
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-8 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>

        {loading ? (
          <p className="text-zinc-500">Loading...</p>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              AI System Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={18}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm leading-relaxed outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <p className="text-xs text-zinc-400">
              This prompt is sent to Claude as the system instruction when summarizing discharge notes.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="self-start rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {saving ? "Saving..." : saved ? "Saved!" : "Save"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
