"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Nav({ logoOnly = false }: { logoOnly?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setName(data.user?.name || null);
        setRole(data.user?.role || null);
      });
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  const mainLinks = [
    { href: "/upload", label: "Upload" },
    { href: "/history", label: "Archive" },
  ];

  return (
    <nav className="border-b border-zinc-200 bg-[#f5f1e7] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex-shrink-0">
          <Image src="/tacc_logo.png" alt="TACC" width={120} height={30} className="dark:invert" />
        </Link>

        {!logoOnly && (
        <div className="flex items-center gap-6">
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                pathname === link.href
                  ? "font-medium text-black dark:text-zinc-50"
                  : "text-black/60 hover:text-black hover:font-medium dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        )}

        {!logoOnly && name && (
          <div
            className="relative"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <button className="py-2 text-sm text-black/60 transition-colors hover:text-black hover:font-medium dark:text-zinc-400 dark:hover:text-zinc-200">
              Hi, {name}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full z-50 min-w-[140px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <Link
                  href="/settings"
                  className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Settings
                </Link>
                {role === "admin" && (
                  <Link
                    href="/admin"
                    className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
