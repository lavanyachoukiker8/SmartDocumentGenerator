"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  FileText,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  AlertCircle,
  FileCheck,
  ChevronRight,
  ExternalLink,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/status-chip";
import { getEvent, listDocuments, regenerateFromEvent } from "@/lib/api";
import type { ClubEvent, DocumentSummary } from "@/lib/types";
import { formatDateRange, formatDateTime } from "@/lib/format";
import { toast } from "sonner";

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default function EventOverviewPage({ params }: EventPageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;

  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [evt, docs] = await Promise.all([
        getEvent(eventId),
        listDocuments({ eventId }),
      ]);
      setEvent(evt);
      setDocuments(docs);
    } catch (err: any) {
      toast.error(err.message || "Failed to load event");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      await regenerateFromEvent(eventId);
      toast.success("All documents synced with latest event data!");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (loading || !event) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-slate-500 font-medium">Loading event details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Event Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Event Overview
              </span>
              <StatusChip status={event.status} size="sm" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1F3A5F]">{event.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/event/${eventId}/review`}>
              <Button variant="outline" size="sm" className="text-xs gap-1.5 border-slate-200">
                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                <span>Review Fields</span>
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 border-t border-slate-100 pt-3">
          {event.startDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#4F81BD]" />
              <span className="font-medium">{formatDateRange(event.startDate, event.endDate)}</span>
            </div>
          )}
          {event.venue && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#4F81BD]" />
              <span>{event.venue}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="capitalize font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {event.category}
            </span>
          </div>
          <span className="text-slate-400 ml-auto">Created {formatDateTime(event.createdAt)}</span>
        </div>
      </div>

      {/* Sync Changes Banner when event data changed after generation */}
      {event.changedSinceGeneration && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">Event details updated after documents were created</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Fields changed: <span className="font-semibold">{event.changedKeys.join(", ")}</span>. Sync to create new document versions with updated information.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>Sync Changes to All Docs</span>
          </Button>
        </div>
      )}

      {/* Generated Documents List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Generated Documents ({documents.length})</h2>
            <p className="text-xs text-slate-500">Official letters, forms and certificates for this event</p>
          </div>
          <Link href={`/event/${eventId}/review`}>
            <Button size="sm" className="bg-[#4F81BD] hover:bg-[#3d689b] text-white text-xs gap-1.5">
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Generate More</span>
            </Button>
          </Link>
        </div>

        {documents.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-slate-300">
            <FileText className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="font-semibold text-slate-700">No documents generated yet</p>
            <p className="text-xs text-slate-500 mt-1">Review the extracted fields and select recommended documents.</p>
            <Link href={`/event/${eventId}/review`}>
              <Button size="sm" className="mt-4 bg-[#4F81BD]">
                Go to Review & Generate
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="hover:border-slate-300 transition-all border-slate-200 shadow-2xs group flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-bold text-slate-900 group-hover:text-[#4F81BD] transition-colors">
                        {doc.templateName}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Last updated {formatDateTime(doc.updatedAt)}
                      </CardDescription>
                    </div>
                    <StatusChip status={doc.status} size="sm" />
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                        v{doc.currentVersion}
                      </span>
                      {doc.outOfSync && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium border border-amber-200">
                          Out of sync
                        </span>
                      )}
                    </div>
                    <Link href={`/event/${eventId}/doc/${doc.id}`}>
                      <Button size="sm" className="h-7 text-xs bg-slate-900 hover:bg-slate-800 text-white gap-1">
                        <span>Open Editor</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
