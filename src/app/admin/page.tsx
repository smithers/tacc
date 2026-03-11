"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/nav";

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) return router.push("/");
      const data = await r.json();
      if (data.user.role !== "admin") router.push("/upload");
    });
  }, [router]);

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, name: newName, password: newPassword, role: newRole }),
    });
    setNewEmail("");
    setNewName("");
    setNewPassword("");
    setNewRole("user");
    loadUsers();
  }

  async function handleDelete(userId: string) {
    if (!confirm("Delete this user?")) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    loadUsers();
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUserId) return;
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: resetUserId, newPassword: resetPassword }),
    });
    setResetUserId(null);
    setResetPassword("");
  }

  return (
    <div className="min-h-screen bg-[#f5f1e7] dark:bg-zinc-950">
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-8 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Admin — User Management
        </h1>

        {/* Create User */}
        <form onSubmit={handleCreate} className="mb-10 flex flex-col gap-3 rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Create User</h2>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} required className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50" />
            <input type="email" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50" />
            <input type="password" placeholder="Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50" />
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="self-start rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
            Create
          </button>
        </form>

        {/* User List */}
        {loading ? (
          <p className="text-zinc-500">Loading...</p>
        ) : (
          <div className="flex flex-col gap-3">
            {users.map((u) => {
              const isLastAdmin = u.role === "admin" && users.filter((x) => x.role === "admin").length === 1;
              return (
              <div key={u.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-900">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{u.name}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{u.email} — {u.role}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setResetUserId(u.id)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                    Reset PW
                  </button>
                  {!isLastAdmin && (
                  <button onClick={() => handleDelete(u.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">
                    Delete
                  </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Reset Password Modal */}
        {resetUserId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <form onSubmit={handleResetPassword} className="flex w-80 flex-col gap-4 rounded-2xl bg-white p-6 dark:bg-zinc-900">
              <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Reset Password</h2>
              <input type="password" placeholder="New password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50" />
              <div className="flex gap-2">
                <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900">Reset</button>
                <button type="button" onClick={() => setResetUserId(null)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-700 dark:text-zinc-300">Cancel</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
