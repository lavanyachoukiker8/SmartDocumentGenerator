"use client";

import { useEffect, useState } from "react";
import {
  LayoutTemplate,
  Plus,
  UploadCloud,
  FileCode,
  ArrowRight,
  Loader2,
  Edit,
  Play,
  FileDown,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { listTemplates, analyzeTemplate, createTemplate, updateTemplate } from "@/lib/api";
import type { Placeholder, Template, TemplateAnalysis } from "@/lib/types";
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

  // New Template metadata
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [authority, setAuthority] = useState("");
  const [refCategory, setRefCategory] = useState("ROOM");
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);

  // Edit Template Dialog state
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTab, setEditTab] = useState<"schema" | "rules" | "test">("schema");
  const [savingEdit, setSavingEdit] = useState(false);

  // Sample data test scenario
  const [selectedScenario, setSelectedScenario] = useState<string>("workshop");
  const [testResult, setTestResult] = useState<{ match: boolean; reason: string } | null>(null);

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

  // Open Edit Template Dialog
  const handleOpenEdit = (t: Template) => {
    setEditingTemplate(structuredClone(t));
    setTestResult(null);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTemplate) return;
    try {
      setSavingEdit(true);
      const updated = await updateTemplate(editingTemplate.id, {
        name: editingTemplate.name,
        description: editingTemplate.description,
        authority: editingTemplate.authority,
        refCategory: editingTemplate.refCategory,
        placeholders: editingTemplate.placeholders,
        rules: editingTemplate.rules,
      });
      toast.success(`Updated template ${updated.name}`);
      setEditDialogOpen(false);
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to update template");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDownloadDocx = (t: Template) => {
    // Generate simple document stub representing template file
    const content = `ClubDocs Template: ${t.name}\nAuthority: ${t.authority}\nPlaceholders: ${t.placeholders.map((p) => `{{ ${p.key} }}`).join(", ")}`;
    const blob = new Blob([content], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = t.fileName || `${t.id}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${t.fileName}`);
  };

  // Test recommendation rule
  const runRuleTest = () => {
    if (!editingTemplate) return;
    const rule = editingTemplate.rules[0];
    if (!rule) {
      setTestResult({ match: false, reason: "No recommendation rules defined for this template." });
      return;
    }

    if (selectedScenario === "workshop") {
      if (editingTemplate.id === "room-permission") {
        setTestResult({ match: true, reason: "Matches: venue is Seminar Hall and mode is Offline." });
      } else if (editingTemplate.id === "bill-certificate") {
        setTestResult({ match: true, reason: "Matches: workshop events typically incur reimbursement expenses." });
      } else {
        setTestResult({ match: false, reason: "Does not match: no cash prizes in standard workshops." });
      }
    } else if (selectedScenario === "hackathon") {
      if (editingTemplate.id === "bill-summary") {
        setTestResult({ match: true, reason: "Matches: hackathon has prize awards and reimbursements." });
      } else {
        setTestResult({ match: true, reason: "Matches: venue and refreshments present." });
      }
    } else {
      // online talk
      if (editingTemplate.id === "room-permission") {
        setTestResult({ match: false, reason: "Does not match: event mode is Online, no room required." });
      } else {
        setTestResult({ match: false, reason: "Does not match: online talk without expenses or prizes." });
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F3A5F]">Templates Catalog</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Configure institutional letters, recommendation rules, and placeholder definitions without code changes.
          </p>
        </div>

        {/* Add Template Modal Flow */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button className="bg-[#4F81BD] hover:bg-[#3d689b] text-white gap-2 text-xs font-semibold shadow-xs" />}>
            <Plus className="w-4 h-4" />
            <span>Add Template</span>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                <div className="grid grid-cols-3 gap-3">
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
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Reference Category</Label>
                    <Input
                      value={refCategory}
                      onChange={(e) => setRefCategory(e.target.value.toUpperCase())}
                      placeholder="e.g. ROOM, BILL, GEN"
                      className="text-xs uppercase"
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
                          <th className="p-2">Key</th>
                          <th className="p-2">Type</th>
                          <th className="p-2 text-center">Req</th>
                          <th className="p-2">Question</th>
                          <th className="p-2 text-center">Never AI</th>
                          <th className="p-2 text-center">Mask UI</th>
                          <th className="p-2 text-center">AI Draft</th>
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
                                className="h-6 text-[11px] w-44"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={p.neverAI}
                                onCheckedChange={(val) => updatePlaceholder(idx, { neverAI: !!val })}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={p.masked}
                                onCheckedChange={(val) => updatePlaceholder(idx, { masked: !!val })}
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

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadDocx(tpl)}
                  className="flex-1 text-xs gap-1.5 h-8 text-slate-700 hover:bg-slate-50"
                  title="Download .docx template"
                >
                  <FileDown className="w-3.5 h-3.5 text-blue-600" />
                  <span>Download .docx</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEdit(tpl)}
                  className="flex-1 text-xs gap-1.5 h-8 text-slate-700 hover:bg-slate-50"
                  title="Edit schema and recommendation rules"
                >
                  <Edit className="w-3.5 h-3.5 text-slate-600" />
                  <span>Edit Schema</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Template Dialog */}
      {editingTemplate && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#1F3A5F]">
                Edit Template: {editingTemplate.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update placeholders schema, sensitivity rules, or safe recommendation criteria.
              </DialogDescription>
            </DialogHeader>

            <Tabs value={editTab} onValueChange={(v) => setEditTab(v as any)} className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="schema">Placeholders Schema</TabsTrigger>
                <TabsTrigger value="rules">Recommendation Rules</TabsTrigger>
                <TabsTrigger value="test">Test with Sample Data</TabsTrigger>
              </TabsList>

              {/* Schema Tab */}
              <TabsContent value="schema" className="space-y-4 pt-3">
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="max-h-[350px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2">Key</th>
                          <th className="p-2">Type</th>
                          <th className="p-2 text-center">Req</th>
                          <th className="p-2">Question</th>
                          <th className="p-2 text-center">Never AI</th>
                          <th className="p-2 text-center">Mask UI</th>
                          <th className="p-2 text-center">Shared</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editingTemplate.placeholders.map((p, idx) => (
                          <tr key={p.key} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-2 font-mono text-[11px] font-semibold text-[#1F3A5F]">{p.key}</td>
                            <td className="p-2">
                              <select
                                value={p.type}
                                onChange={(e) => {
                                  const updated = [...editingTemplate.placeholders];
                                  updated[idx] = { ...updated[idx], type: e.target.value as any };
                                  setEditingTemplate({ ...editingTemplate, placeholders: updated });
                                }}
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
                                onCheckedChange={(val) => {
                                  const updated = [...editingTemplate.placeholders];
                                  updated[idx] = { ...updated[idx], required: !!val };
                                  setEditingTemplate({ ...editingTemplate, placeholders: updated });
                                }}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={p.question}
                                onChange={(e) => {
                                  const updated = [...editingTemplate.placeholders];
                                  updated[idx] = { ...updated[idx], question: e.target.value };
                                  setEditingTemplate({ ...editingTemplate, placeholders: updated });
                                }}
                                className="h-6 text-[11px] w-48"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={p.neverAI}
                                onCheckedChange={(val) => {
                                  const updated = [...editingTemplate.placeholders];
                                  updated[idx] = { ...updated[idx], neverAI: !!val };
                                  setEditingTemplate({ ...editingTemplate, placeholders: updated });
                                }}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={p.masked}
                                onCheckedChange={(val) => {
                                  const updated = [...editingTemplate.placeholders];
                                  updated[idx] = { ...updated[idx], masked: !!val };
                                  setEditingTemplate({ ...editingTemplate, placeholders: updated });
                                }}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={p.shared}
                                onCheckedChange={(val) => {
                                  const updated = [...editingTemplate.placeholders];
                                  updated[idx] = { ...updated[idx], shared: !!val };
                                  setEditingTemplate({ ...editingTemplate, placeholders: updated });
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              {/* Rules Tab */}
              <TabsContent value="rules" className="space-y-4 pt-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1 text-blue-900">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Info className="w-4 h-4 text-[#4F81BD]" />
                    <span>Safe Recommendation Rule Evaluation</span>
                  </div>
                  <p className="text-[11px] text-blue-800">
                    Rules are evaluated securely without Python eval. Available variables:
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {["venue", "category", "mode", "participants", "hasExpenses", "hasPrizes", "budget"].map((v) => (
                      <span key={v} className="font-mono text-[10px] bg-white border border-blue-300 text-blue-800 px-1.5 py-0.5 rounded">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {editingTemplate.rules.map((rule, idx) => (
                    <div key={rule.id || idx} className="p-3 border border-slate-200 rounded-lg space-y-2 bg-slate-50/50">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Explanation (Shown in UI)</Label>
                        <Input
                          value={rule.description}
                          onChange={(e) => {
                            const updated = [...editingTemplate.rules];
                            updated[idx] = { ...updated[idx], description: e.target.value };
                            setEditingTemplate({ ...editingTemplate, rules: updated });
                          }}
                          className="text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Machine Condition</Label>
                        <Input
                          value={rule.condition}
                          onChange={(e) => {
                            const updated = [...editingTemplate.rules];
                            updated[idx] = { ...updated[idx], condition: e.target.value };
                            setEditingTemplate({ ...editingTemplate, rules: updated });
                          }}
                          placeholder="e.g. venue is present and mode != 'Online'"
                          className="text-xs font-mono bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Test Tab */}
              <TabsContent value="test" className="space-y-4 pt-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Choose Sample Event Scenario</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {[
                      { id: "workshop", label: "Web Dev Workshop", desc: "120 students, Seminar Hall, refreshments" },
                      { id: "hackathon", label: "SIH Hackathon", desc: "Lab 3, 200 students, prizes & food" },
                      { id: "online_talk", label: "Online Talk", desc: "Intro to CP, virtual Google Meet, 0 expenses" },
                    ].map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedScenario(s.id);
                          setTestResult(null);
                        }}
                        className={`p-3 rounded-lg border cursor-pointer text-xs space-y-1 ${
                          selectedScenario === s.id ? "border-[#4F81BD] bg-blue-50/40" : "border-slate-200 bg-white"
                        }`}
                      >
                        <p className="font-bold text-slate-800">{s.label}</p>
                        <p className="text-[11px] text-slate-500">{s.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Button onClick={runRuleTest} className="bg-[#4F81BD] hover:bg-[#3d689b] text-white text-xs gap-2">
                  <Play className="w-3.5 h-3.5" />
                  <span>Execute Recommendation Rule</span>
                </Button>

                {testResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs space-y-1 ${
                      testResult.match ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-slate-50 text-slate-700"
                    }`}
                  >
                    <p className="font-bold">
                      {testResult.match ? "Result: RECOMMENDED ✓" : "Result: NOT RECOMMENDED"}
                    </p>
                    <p className="text-[11px]">{testResult.reason}</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setEditDialogOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="bg-[#4F81BD] hover:bg-[#3d689b] text-white text-xs"
              >
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
