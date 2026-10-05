"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  FileText,
  PlusCircle,
  LayoutTemplate,
  Settings,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isMockMode } from "@/lib/api";
import { useUserRole } from "@/lib/useRole";
import type { UserRole } from "@/lib/types";

export function Navbar() {
  const pathname = usePathname();
  const { role, setRole, mounted } = useUserRole();

  const navLinks = [
    { href: "/", label: "Dashboard", icon: FileText },
    { href: "/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/history", label: "History", icon: History },
    { href: "/settings", label: "Club Settings", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 bg-white shadow-xs p-1">
              <Image src="/logos/acm.svg" alt="ACM Logo" fill className="object-contain" priority />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg text-[#1F3A5F] tracking-tight group-hover:text-[#4F81BD] transition-colors">
                  ClubDocs
                </span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-[#4F81BD] border border-blue-200">
                  ACM SVNIT
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">Smart Document Generator</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${
                    isActive
                      ? "bg-slate-100 text-[#1F3A5F] font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#4F81BD]" : "text-slate-400"}`} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Mock Mode & Role Switcher */}
          {isMockMode && (
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Mock Mode
              </span>
              <span className="text-amber-300">|</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[11px]">Role:</span>
                {mounted ? (
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="text-xs font-semibold bg-white border border-amber-300 rounded px-1.5 py-0.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#4F81BD]"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="faculty">Faculty</option>
                  </select>
                ) : (
                  <span className="text-xs font-semibold text-slate-800">Admin</span>
                )}
              </div>
            </div>
          )}

          <Link href="/new">
            <Button className="bg-[#4F81BD] hover:bg-[#3d689b] text-white shadow-xs gap-2 font-medium">
              <PlusCircle className="w-4 h-4" />
              <span>New Document</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
