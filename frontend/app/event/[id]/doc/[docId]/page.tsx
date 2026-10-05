"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Save,
  Download,
  FileDown,
  History,
  RefreshCw,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  Lock,
  FileText,
  Eye,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { StatusChip } from "@/components/status-chip";
import { Stepper } from "@/components/stepper";
import { MaskedInput } from "@/components/masked-input";
import { A4DocumentPreview } from "@/components/a4-preview";
import {
  getDocument,
  getTemplate,
  getClub,
  saveDocument,
  restoreVersion,
  exportDocument,
  regenerateFromEvent,
  setDocumentStatus,
  isMockMode,
} from "@/lib/api";
import { useUserRole } from "@/lib/useRole";
import type { Club, FieldValue, FieldValues, GeneratedDocument, TableRow, Template } from "@/lib/types";
import { asRows, asText, groupBySection, isEmptyValue } from "@/lib/fields";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

interface DocEditorPageProps {
  params: Promise<{ id: string; docId: string }>;
}

export default function DocumentEditorPage({ params }: DocEditorPageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;
  const docId = resolvedParams.docId;

  const { role } = useUserRole();

  const [document, setDocument] = useState<GeneratedDocument | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // PDF Preview Modal
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loadingPdfPreview, setLoadingPdfPreview] = useState(false);

  // Form values being edited locally
  const [values, setValues] = useState<FieldValues>({});
  const [isDirty, setIsDirty] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [doc, clb] = await Promise.all([getDocument(docId), getClub()]);
      const tpl = await getTemplate(doc.templateId);
      setDocument(doc);
      setTemplate(tpl);
      setClub(clb);
      setValues(doc.values);
      setIsDirty(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to load document");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [docId]);

  // Clean up blob url on unmount or change
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const handleFieldChange = (key: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  // Table row editing
  const handleAddTableRow = (key: string, emptyRow: TableRow) => {
    const existing = asRows(values[key]);
    handleFieldChange(key, [...existing, { ...emptyRow }]);
  };

  const handleRemoveTableRow = (key: string, index: number) => {
    const existing = asRows(values[key]);
    handleFieldChange(
      key,
      existing.filter((_, i) => i !== index)
    );
  };

  const handleTableCellChange = (key: string, index: number, colKey: string, val: string) => {
    const existing = asRows(values[key]);
    const updated = existing.map((r, i) => {
      if (i === index) {
        const nextRow = { ...r, [colKey]: val };
        // Auto-calculate total in items table if qty or unit_cost changed
        if (key === "items" && (colKey === "qty" || colKey === "unit_cost")) {
          const q = parseFloat(nextRow.qty) || 0;
          const u = parseFloat(nextRow.unit_cost) || 0;
          nextRow.total = String(q * u);
        }
        return nextRow;
      }
      return r;
    });
    handleFieldChange(key, updated);
  };

  const handleSave = async (note = "Updated field values") => {
    try {
      setSaving(true);
      const res = await saveDocument(docId, values, note);
      setDocument(res.document);
      setIsDirty(false);
      if (res.propagatedTo.length > 0) {
        const fieldsList = res.updatedFields?.length ? ` (${res.updatedFields.join(", ")})` : "";
        toast.info(
          `Saved v${res.document.currentVersion}. Changes to shared fields${fieldsList} updated ${res.propagatedTo.length} other ${res.propagatedTo.length === 1 ? "document" : "documents"}.`
        );
      } else {
        toast.success(`Saved document v${res.document.currentVersion}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save document");
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (version: number) => {
    try {
      const res = await restoreVersion(docId, version);
      setDocument(res);
      setValues(res.values);
      setIsDirty(false);
      toast.success(`Restored to version v${version}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to restore version");
    }
  };

  const handleRegenerate = async () => {
    if (!confirm("Regenerate all documents for this event with the latest event profile values?")) return;
    try {
      setRegenerating(true);
      await regenerateFromEvent(eventId);
      toast.success("Regenerated all documents from latest event data!");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate");
    } finally {
      setRegenerating(false);
    }
  };

  const handlePreviewPdf = async () => {
    if (isMockMode) {
      setPdfModalOpen(true);
      return;
    }
    try {
      setLoadingPdfPreview(true);
      const res = await exportDocument(docId, "pdf");
      if (res.kind === "file") {
        if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
        const url = URL.createObjectURL(res.blob);
        setPdfBlobUrl(url);
        setPdfModalOpen(true);
      } else {
        window.print();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load PDF preview");
    } finally {
      setLoadingPdfPreview(false);
    }
  };

  const handleExport = async (format: "docx" | "pdf") => {
    try {
      if (format === "docx") setExportingDocx(true);
      else setExportingPdf(true);

      const res = await exportDocument(docId, format);
      if (res.kind === "print") {
        window.print();
        toast.info("Opened print dialog for A4 PDF export");
      } else {
        const url = URL.createObjectURL(res.blob);
        const a = window.document.createElement("a");
        a.href = url;
        a.download = res.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${res.filename}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setExportingDocx(false);
      setExportingPdf(false);
    }
  };

  const handleToggleApproved = async () => {
    if (!document) return;
    if (role === "member") {
      toast.error("Approval requires Faculty or Admin role.");
      return;
    }
    const nextStatus = document.status === "approved" ? "ready" : "approved";
    try {
      const updated = await setDocumentStatus(docId, nextStatus);
      setDocument(updated);
      toast.success(`Document marked as ${nextStatus}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (loading || !document || !template || !club) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#4F81BD]" />
        <p className="text-sm text-slate-500 font-medium">Opening Document Editor...</p>
      </div>
    );
  }

  const sections = groupBySection(template.placeholders);

  // Compute changed shared fields for notice
  const changedSharedPlaceholders = template.placeholders.filter(
    (p) => p.shared && JSON.stringify(values[p.key]) !== JSON.stringify(document.values[p.key])
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="print:hidden">
        <Stepper currentStep="edit" eventId={eventId} docId={docId} />
      </div>

      {/* Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs print:hidden">
        <div className="flex items-center gap-3">
          <Link href={`/event/${eventId}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#1F3A5F]">{document.title}</h1>
              <StatusChip status={document.status} size="sm" />
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                v{document.currentVersion}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Authority: <span className="font-semibold text-slate-700">{template.authority}</span> · Ref Category: {template.refCategory}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Version history sheet drawer */}
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-200" />}>
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>History ({document.versions.length})</span>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="text-base font-bold text-[#1F3A5F]">Version History</SheetTitle>
                <SheetDescription className="text-xs">
                  Review snapshots or restore an earlier version of this document.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-3">
                {document.versions
                  .slice()
                  .reverse()
                  .map((v) => (
                    <div
                      key={v.version}
                      className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                        v.version === document.currentVersion
                          ? "border-[#4F81BD] bg-blue-50/50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-[#1F3A5F]">
                          Version {v.version} {v.version === document.currentVersion && "(Current)"}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDateTime(v.createdAt)}
                        </span>
                      </div>
                      <p className="text-slate-600">{v.note}</p>
                      <p className="text-[11px] text-slate-400">By {v.author}</p>
                      {v.version !== document.currentVersion && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(v.version)}
                          className="h-7 text-xs text-[#4F81BD] hover:bg-blue-50 px-2 gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore v{v.version}</span>
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
            </SheetContent>
          </Sheet>

          {/* Regenerate all from event */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="gap-1.5 text-xs text-slate-700"
            title="Update all documents with latest event values"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
            <span>Regenerate all</span>
          </Button>

          {/* Preview PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviewPdf}
            disabled={loadingPdfPreview}
            className="gap-1.5 text-xs text-slate-700"
            title="Preview rendered PDF"
          >
            {loadingPdfPreview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 text-slate-600" />}
            <span>Preview PDF</span>
          </Button>

          {/* Download DOCX */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("docx")}
            disabled={exportingDocx}
            className="gap-1.5 text-xs text-slate-700"
          >
            {exportingDocx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 text-blue-600" />}
            <span>Download DOCX</span>
          </Button>

          {/* Download PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={exportingPdf}
            className="gap-1.5 text-xs text-slate-700"
          >
            {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-red-600" />}
            <span>Download PDF</span>
          </Button>

          {/* Save button */}
          <Button
            onClick={() => handleSave()}
            disabled={saving || !isDirty}
            className="bg-[#4F81BD] hover:bg-[#3d689b] text-white text-xs gap-1.5 font-semibold"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save (v{document.currentVersion + 1})</span>
          </Button>

          {/* Mark approved */}
          <Button
            variant={document.status === "approved" ? "secondary" : "default"}
            size="sm"
            onClick={handleToggleApproved}
            disabled={role === "member"}
            title={role === "member" ? "Only Faculty or Admin can approve documents" : undefined}
            className={`text-xs gap-1.5 font-semibold ${
              role === "member"
                ? "opacity-60 cursor-not-allowed"
                : document.status === "approved"
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                : "bg-emerald-700 hover:bg-emerald-800 text-white"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{document.status === "approved" ? "Approved ✓" : "Mark as Approved"}</span>
          </Button>
        </div>
      </div>

      {/* Out of Sync Warning Banner */}
      {document.outOfSync && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-800 print:hidden">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Event data was updated after this document was created. Sync latest changes?</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRegenerate}
            className="h-7 text-xs border-amber-300 bg-white hover:bg-amber-100"
          >
            Sync Now
          </Button>
        </div>
      )}

      {/* Notice when editing shared fields */}
      {changedSharedPlaceholders.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-xs text-blue-900 print:hidden">
          <Info className="w-4 h-4 text-[#4F81BD] shrink-0" />
          <span>
            <b>Shared field edit:</b> You modified{" "}
            {changedSharedPlaceholders.map((p) => p.label).join(", ")}. Saving this document will automatically update all other documents for this event to maintain consistency.
          </span>
        </div>
      )}

      {/* Editor Split View: Left = Field Editor | Right = Live A4 Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Grouped Field Editor (5 cols) */}
        <div className="lg:col-span-5 space-y-4 print:hidden max-h-[85vh] overflow-y-auto pr-2">
          {sections.map(([sectionName, placeholders]) => (
            <Card key={sectionName} className="border-slate-200 shadow-2xs">
              <CardHeader className="py-2.5 px-4 bg-slate-50/70 border-b border-slate-100">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {sectionName}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {placeholders.map((p) => {
                  const val = values[p.key];
                  const isMasked = p.masked;
                  const isShared = p.shared;
                  const isNeverAI = p.neverAI;

                  return (
                    <div key={p.key} className="space-y-1.5 pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`ed-${p.key}`} className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          {p.label}
                          {p.required && <span className="text-red-500">*</span>}
                        </Label>
                        <div className="flex items-center gap-1.5">
                          {isShared && (
                            <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded font-medium">
                              Shared field
                            </span>
                          )}
                          {isMasked ? (
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              Masked
                            </span>
                          ) : isNeverAI ? (
                            <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                              Official
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {p.helpText && (
                        <p className="text-[11px] text-slate-500">{p.helpText}</p>
                      )}

                      {/* Text / Number / Date / Time inputs */}
                      {(p.type === "text" || p.type === "number" || p.type === "date" || p.type === "time") && !isMasked && (
                        <Input
                          id={`ed-${p.key}`}
                          type={p.type === "number" ? "number" : p.type === "date" ? "date" : p.type === "time" ? "time" : "text"}
                          value={(val as string) || ""}
                          onChange={(e) => handleFieldChange(p.key, e.target.value)}
                          placeholder={p.question}
                          className="text-xs"
                        />
                      )}

                      {/* Masked input */}
                      {p.type === "text" && isMasked && (
                        <MaskedInput
                          id={`ed-${p.key}`}
                          value={(val as string) || ""}
                          onChange={(v) => handleFieldChange(p.key, v)}
                          placeholder={p.question}
                          className="text-xs"
                        />
                      )}

                      {/* Long text */}
                      {p.type === "longtext" && (
                        <Textarea
                          id={`ed-${p.key}`}
                          rows={3}
                          value={(val as string) || ""}
                          onChange={(e) => handleFieldChange(p.key, e.target.value)}
                          placeholder={p.question}
                          className="text-xs leading-relaxed"
                        />
                      )}

                      {/* Table field with row add/remove */}
                      {p.type === "table" && p.columns && (
                        <div className="space-y-2 mt-2 pt-1 border-t border-slate-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-600">
                              Table: {p.label} ({asRows(val).length} rows)
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const emptyRow: TableRow = {};
                                p.columns?.forEach((c) => {
                                  emptyRow[c.key] = "";
                                });
                                handleAddTableRow(p.key, emptyRow);
                              }}
                              className="h-6 text-[10px] px-2 text-[#4F81BD] border-blue-200 hover:bg-blue-50 gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add row</span>
                            </Button>
                          </div>

                          <div className="space-y-2">
                            {asRows(val).map((row, rIdx) => (
                              <div
                                key={rIdx}
                                className="p-2 rounded bg-slate-50 border border-slate-200 text-xs space-y-1.5 relative group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-slate-500 text-[10px]">Row {rIdx + 1}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveTableRow(p.key, rIdx)}
                                    className="h-5 w-5 text-red-500 hover:bg-red-50 hover:text-red-700"
                                    title="Remove row"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {p.columns?.map((col) => (
                                    <div key={col.key} className="space-y-0.5">
                                      <span className="text-[10px] text-slate-500">{col.label}</span>
                                      {col.masked ? (
                                        <MaskedInput
                                          id={`tbl-${p.key}-${rIdx}-${col.key}`}
                                          value={row[col.key] || ""}
                                          onChange={(v) => handleTableCellChange(p.key, rIdx, col.key, v)}
                                          className="h-7 text-xs bg-white"
                                        />
                                      ) : (
                                        <Input
                                          value={row[col.key] || ""}
                                          onChange={(e) => handleTableCellChange(p.key, rIdx, col.key, e.target.value)}
                                          className="h-7 text-xs bg-white"
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right Column: Live A4 Letterhead Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 print:hidden">
            <span>Live A4 Letterhead Preview (Quick Live Mode)</span>
            <span className="italic">Unfilled fields highlighted yellow</span>
          </div>
          <A4DocumentPreview templateId={template.id} values={values} club={club} />
        </div>
      </div>

      {/* PDF Exact Preview Dialog */}
      <Dialog open={pdfModalOpen} onOpenChange={setPdfModalOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1F3A5F] flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-600" />
              <span>Exact Output PDF Preview</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isMockMode
                ? "In Mock Mode, PDF export uses browser print layout. In Real Backend Mode (FastAPI + LibreOffice headless), the exact pixel-identical PDF rendered from the .docx template will display here."
                : "This preview is the exact binary PDF rendered by the backend from the official .docx template via headless LibreOffice."}
            </DialogDescription>
          </DialogHeader>

          {isMockMode ? (
            <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center space-y-3 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800">
                You are currently running ClubDocs in Mock Mode.
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                The quick live preview on the right shows the styled A4 view. To generate a real PDF in mock mode, click Print below to use your browser&apos;s Print to PDF engine.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <Button
                  onClick={() => {
                    setPdfModalOpen(false);
                    window.print();
                  }}
                  className="bg-[#4F81BD] hover:bg-[#3d689b] text-white text-xs gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Print / Save as PDF</span>
                </Button>
              </div>
            </div>
          ) : pdfBlobUrl ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <iframe src={pdfBlobUrl} className="w-full h-[700px] border-0" title="Backend PDF Output" />
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Loading PDF from backend...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
