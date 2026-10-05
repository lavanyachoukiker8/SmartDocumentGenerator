"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutTemplate,
  Plus,
  UploadCloud,
  FileCode,
  Shield,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Eye,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { listTemplates, analyzeTemplate, createTemplate } from "@/lib/api";
import type { Placeholder, Template, TemplateAnalysis } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Template Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "reviewSchema">("upload");
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [yamlFile, setYamlFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<TemplateAnalysis | null>(null);

  // Template metadata
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [authority, setAuthority] = useState("");
  const [refCategory, setRefCategory] = useState("ROOM");
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const list = await listTemplates();
      setTemplates(list);
    } catch (err: any) {
      toast.error(err.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleAnalyze = async () => {
    if (!docxFile) {
      toast.error("Please select a .docx file.");
      return;
    }
    try {
      setAnalyzing(true);
      const res = await analyzeTemplate(docxFile, yamlFile);
      setAnalysis(res);
      setPlaceholders(res.detected);
      setName(docxFile.name.replace(/\.docx$/i, "").replace(/[_-]/g, " "));
      setDescription("Custom template uploaded by club admin.");
      setAuthority("HoD / Dean");
      setStep("reviewSchema");
      toast.success("Detected placeholders successfully!");
    } catch (err: any) {
      toast.error(err.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please provide a template name");
      return;
    }
    try {
      await createTemplate({
        name,
        description,
        authority,
        refCategory,
        fileName: docxFile?.name || "template.docx",
        placeholders,
        rules: analysis?.suggestedRules || [],
      });
      toast.success("New template added successfully!");
      setDialogOpen(false);
      setStep("upload");
      setDocxFile(null);
      setYamlFile(null);
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to create template");
    }
  };

  const updatePlaceholder = (index: number, patch: Partial<Placeholder>) => {
    setPlaceholders((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F3A5F]">Templates Catalog</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Configure institutional letters, recommendation rules, and placeholder definitions.
          </p>
        </div>

        {/* Add Template Modal Flow */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button className="bg-[#4F81BD] hover:bg-[#3d689b] text-white gap-2 text-xs font-semibold shadow-xs" />}>
            <Plus className="w-4 h-4" />
            <span>Add Template</span>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#1F3A5F]">
                {step === "upload" ? "Upload New Document Template" : "Review Detected Schema & Rules"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {step === "upload"
                  ? "Upload a .docx template containing {{placeholders}} and an optional schema YAML."
                  : "Configure field types, required checks, and sensitive data protections."}
              </DialogDescription>
            </DialogHeader>

            {step === "upload" && (
              <div className="space-y-4 pt-2">
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-[#4F81BD] transition-colors space-y-2 bg-slate-50/50">
                  <UploadCloud className="w-8 h-8 text-[#4F81BD] mx-auto" />
                  <p className="text-xs font-bold text-slate-800">Select Template (.docx) *</p>
                  <p className="text-[11px] text-slate-500">Supports standard Word documents with Jinja / Mustache tags</p>
                  <input
                    type="file"
                    accept=".docx"
                    onChange={(e) => setDocxFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 mx-auto block mt-2"
                  />
                  {docxFile && (
                    <p className="text-xs font-semibold text-emerald-700">Selected: {docxFile.name}</p>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-800">Optional Schema (.yaml / .yml)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Provide field types, questions, and sensitivity flags ahead of time.
                  </p>
                  <input
                    type="file"
                    accept=".yaml,.yml"
                    onChange={(e) => setYamlFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 block mt-1"
                  />
                  {yamlFile && (
                    <p className="text-xs font-semibold text-purple-700">Selected: {yamlFile.name}</p>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleAnalyze}
                    disabled={!docxFile || analyzing}
                    className="bg-[#4F81BD] hover:bg-[#3d689b] text-white text-xs gap-2"
                  >
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    <span>Analyze Placeholders</span>
                  </Button>
                </div>
              </div>
            )}

            {step === "reviewSchema" && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Template Name *</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Submitted To Authority</Label>
                    <Input
                      value={authority}
                      onChange={(e) => setAuthority(e.target.value)}
                      placeholder="e.g. HoD (CSE Dept.)"
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* Table of detected placeholders */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 p-2 border-b border-slate-200 text-xs font-bold text-slate-700">
                    Detected Placeholders ({placeholders.length})
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2">Placeholder Key</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Required</th>
                          <th className="p-2">Question to Ask</th>
                          <th className="p-2">Sensitive</th>
                          <th className="p-2">AI-Draftable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {placeholders.map((p, idx) => (
                          <tr key={p.key} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-2 font-mono text-[11px] font-semibold text-[#1F3A5F]">{p.key}</td>
                            <td className="p-2">
                              <select
                                value={p.type}
                                onChange={(e) => updatePlaceholder(idx, { type: e.target.value as any })}
                                className="text-[11px] p-1 border rounded bg-white"
                              >
                                <option value="text">text</option>
                                <option value="longtext">longtext</option>
                                <option value="date">date</option>
                                <option value="time">time</option>
                                <option value="number">number</option>
                                <option value="table">table</option>
                              </select>
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={p.required}
                                onCheckedChange={(val) => updatePlaceholder(idx, { required: !!val })}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={p.question}
                                onChange={(e) => updatePlaceholder(idx, { question: e.target.value })}
                                className="h-6 text-[11px] w-48"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={p.sensitive}
                                onCheckedChange={(val) => updatePlaceholder(idx, { sensitive: !!val })}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={p.aiDraftable}
                                onCheckedChange={(val) => updatePlaceholder(idx, { aiDraftable: !!val })}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep("upload")} className="text-xs">
                    Back to Upload
                  </Button>
                  <Button onClick={handleCreate} className="bg-[#4F81BD] hover:bg-[#3d689b] text-white text-xs">
                    Save Template
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((tpl) => (
          <Card key={tpl.id} className="border-slate-200 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                  <LayoutTemplate className="w-5 h-5 text-[#4F81BD]" />
                </div>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {tpl.refCategory}
                </span>
              </div>
              <CardTitle className="text-base font-bold text-slate-900 mt-2">
                {tpl.name}
              </CardTitle>
              <CardDescription className="text-xs line-clamp-2">
                {tpl.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex justify-between">
                  <span>Authority:</span>
                  <span className="font-semibold text-slate-800">{tpl.authority}</span>
                </div>
                <div className="flex justify-between">
                  <span>File:</span>
                  <span className="font-mono text-[11px] text-slate-700">{tpl.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Placeholders:</span>
                  <span className="font-semibold text-slate-800">{tpl.placeholders.length} fields</span>
                </div>
                <div className="flex justify-between">
                  <span>Documents generated:</span>
                  <span className="font-semibold text-slate-800">{tpl.usageCount} times</span>
                </div>
              </div>

              {/* Recommendation Rules Summary */}
              {tpl.rules.length > 0 && (
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <p className="font-bold text-slate-700">Recommendation Rule:</p>
                  <p className="italic">&ldquo;{tpl.rules[0].description}&rdquo;</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
