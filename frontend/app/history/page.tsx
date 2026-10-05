"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  History,
  FileText,
  Filter,
  Download,
  Calendar,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip } from "@/components/status-chip";
import { listDocuments, listTemplates, getStats } from "@/lib/api";
import type { DashboardStats, DocumentSummary, Status, Template } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

export default function HistoryPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadData = async () => {
    try {
      setLoading(true);
      const [docs, tpls, st] = await Promise.all([
        listDocuments(),
        listTemplates(),
        getStats(),
      ]);
      setDocuments(docs);
      setTemplates(tpls);
      setStats(st);
    } catch (err: any) {
      toast.error(err.message || "Failed to load document history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredDocs = documents.filter((doc) => {
    if (templateFilter !== "all" && doc.templateId !== templateFilter) return false;
    if (statusFilter !== "all" && doc.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        doc.eventTitle.toLowerCase().includes(q) ||
        doc.templateName.toLowerCase().includes(q) ||
        doc.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F3A5F]">Document History & Analytics</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Audit trail of generated institutional letters, versions, and current approval statuses.
          </p>
        </div>
      </div>

      {/* Analytics stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Documents Generated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1F3A5F]">{stats?.totalDocuments ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Across all event categories</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Documents This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#4F81BD]">{stats?.documentsThisMonth ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Active turnaround</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Approved & Signed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{stats?.approvedDocuments ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Ready for accounting and hall entry</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search event title or document name..."
                className="pl-9 text-xs h-9"
              />
            </div>

            <div>
              <Select value={templateFilter} onValueChange={(val) => setTemplateFilter(val ?? "all")}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="All Templates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Templates</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? "all")}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="needs_info">Needs Info</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card className="border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Document Title</th>
                <th className="p-3">Template</th>
                <th className="p-3">Status</th>
                <th className="p-3">Version</th>
                <th className="p-3">Updated At</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                    No documents matching filters.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <Link
                        href={`/event/${doc.eventId}/doc/${doc.id}`}
                        className="font-bold text-slate-800 hover:text-[#4F81BD] transition-colors"
                      >
                        {doc.templateName} — {doc.eventTitle}
                      </Link>
                    </td>
                    <td className="p-3 font-medium text-slate-600">{doc.templateName}</td>
                    <td className="p-3">
                      <StatusChip status={doc.status} size="sm" />
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                        v{doc.currentVersion}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">
                      {formatDateTime(doc.updatedAt)}
                    </td>
                    <td className="p-3 text-right">
                      <Link href={`/event/${doc.eventId}/doc/${doc.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-[#4F81BD] hover:bg-blue-50 px-2">
                          <span>Open</span>
                          <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
