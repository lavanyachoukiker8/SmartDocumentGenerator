"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { FileText, PlusCircle, LayoutTemplate, Settings, History, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const pathname = usePathname();

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
              <Image src="/logos/acm.svg" alt="ACM Logo" fill className="object-contain" />
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
