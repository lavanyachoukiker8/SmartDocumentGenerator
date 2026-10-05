"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  LayoutTemplate,
  Settings,
  Sparkles,
  Calendar,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/status-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { listEvents, getStats, resetDemoData } from "@/lib/api";
import type { EventSummary, DashboardStats } from "@/lib/types";
import { formatDateRange, formatDateTime } from "@/lib/format";
import { toast } from "sonner";

export default function DashboardPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [evts, st] = await Promise.all([listEvents(), getStats()]);
      setEvents(evts);
      setStats(st);
    } catch (err) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReset = async () => {
    await resetDemoData();
    toast.success("Demo database reset to initial seed");
    loadData();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#1F3A5F] to-[#2b4c77] rounded-2xl p-6 text-white shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-400/20 text-blue-200 border border-blue-400/30">
              SVNIT Surat · ACM Chapter
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Smart Document Generator</h1>
          <p className="text-sm text-blue-100 max-w-xl">
            Describe your club event in natural language or fill a form to extract fields, review missing details, and generate official letters with letterheads.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/new">
            <Button size="lg" className="bg-[#4F81BD] hover:bg-[#4372a7] text-white font-semibold gap-2 shadow-md">
              <PlusCircle className="w-5 h-5" />
              <span>New Document</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="icon"
            onClick={handleReset}
            className="border-white/20 bg-white/10 hover:bg-white/20 text-white"
            title="Reset Mock Seed Data"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Documents
            </CardTitle>
            <FileText className="w-4 h-4 text-[#4F81BD]" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-[#1F3A5F]">{stats?.totalDocuments ?? 0}</div>
            )}
            <p className="text-xs text-slate-500 mt-1">Generated this academic year</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Approved
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-emerald-700">{stats?.approvedDocuments ?? 0}</div>
            )}
            <p className="text-xs text-slate-500 mt-1">Signed & finalized</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Needs Attention
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-amber-700">{stats?.eventsNeedingInfo ?? 0}</div>
            )}
            <p className="text-xs text-slate-500 mt-1">Events with missing inputs</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Hours Saved
            </CardTitle>
            <Sparkles className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-purple-700">{stats?.hoursSaved ?? 0} hrs</div>
            )}
            <p className="text-xs text-slate-500 mt-1">Estimated drafting & formatting time</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Events & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Events Table / List (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recent Events</h2>
              <p className="text-xs text-slate-500">Track extraction status and generated paperwork</p>
            </div>
            <Link href="/new">
              <Button variant="ghost" size="sm" className="text-[#4F81BD] hover:text-[#1F3A5F] gap-1 text-xs">
                <span>Create new</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>

          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-4 border-slate-200">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </Card>
              ))
            ) : events.length === 0 ? (
              <Card className="p-8 text-center border-dashed border-slate-300">
                <FileText className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="font-semibold text-slate-700">No events found</p>
                <p className="text-xs text-slate-500 mt-1">Start by describing your first event or activity.</p>
                <Link href="/new">
                  <Button size="sm" className="mt-4 bg-[#4F81BD]">
                    New Event
                  </Button>
                </Link>
              </Card>
            ) : (
              events.map((evt) => (
                <Card
                  key={evt.id}
                  className="hover:border-slate-300 transition-all border-slate-200 shadow-2xs hover:shadow-xs group"
                >
                  <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/event/${evt.id}`}
                          className="font-bold text-slate-900 group-hover:text-[#4F81BD] transition-colors text-base"
                        >
                          {evt.title}
                        </Link>
                        <StatusChip status={evt.status} size="sm" />
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded capitalize">
                          {evt.category}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        {evt.startDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatDateRange(evt.startDate, evt.endDate)}</span>
                          </div>
                        )}
                        {evt.venue && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{evt.venue}</span>
                          </div>
                        )}
                        <span className="text-slate-400">•</span>
                        <span>{evt.documentCount} {evt.documentCount === 1 ? "document" : "documents"}</span>
                        {evt.missingCount > 0 && (
                          <span className="text-amber-700 font-medium">({evt.missingCount} missing inputs)</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/event/${evt.id}/review`}>
                        <Button variant="outline" size="sm" className="text-xs border-slate-200">
                          Review Fields
                        </Button>
                      </Link>
                      <Link href={`/event/${evt.id}`}>
                        <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white text-xs">
                          Open Event
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Sidebar / Quick Links & Template Distribution */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">Quick Links</CardTitle>
              <CardDescription className="text-xs">Manage chapter rules and letter templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/templates" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-200 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-white border border-slate-200 group-hover:border-blue-300">
                      <LayoutTemplate className="w-4 h-4 text-[#4F81BD]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Templates Catalog</p>
                      <p className="text-[11px] text-slate-500">View or upload .docx & YAML schemas</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#4F81BD]" />
                </div>
              </Link>

              <Link href="/settings" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-200 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-white border border-slate-200 group-hover:border-blue-300">
                      <Settings className="w-4 h-4 text-[#4F81BD]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Club Settings & Branding</p>
                      <p className="text-[11px] text-slate-500">Signatories, logos & reference counters</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#4F81BD]" />
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Template Breakdown */}
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">Document Types</CardTitle>
              <CardDescription className="text-xs">Generated frequency breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.byTemplate.map((item) => (
                  <div key={item.templateId} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.templateName}</span>
                      <span className="font-bold text-slate-900">{item.count}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-[#4F81BD] rounded-full"
                        style={{
                          width: `${Math.min(100, (item.count / (stats.totalDocuments || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
