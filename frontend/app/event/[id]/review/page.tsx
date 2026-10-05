"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Sparkles,
  ArrowRight,
  Loader2,
  HelpCircle,
  ShieldAlert,
  Info,
  Layers,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Stepper } from "@/components/stepper";
import { FieldSourceBadge } from "@/components/field-source-badge";
import { MaskedInput } from "@/components/masked-input";
import { getEvent, getRecommendations, updateEventFields, generateDocuments } from "@/lib/api";
import type { ClubEvent, DocumentRecommendation, ExtractedField, FieldValue } from "@/lib/types";
import { isEmptyValue, groupBySection } from "@/lib/fields";
import { toast } from "sonner";

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default function ExtractionReviewPage({ params }: ReviewPageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;
  const router = useRouter();

  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [recommendations, setRecommendations] = useState<DocumentRecommendation[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [allowPlaceholders, setAllowPlaceholders] = useState(false);

  // Local draft values for extracted fields
  const [fieldEdits, setFieldEdits] = useState<Record<string, FieldValue>>({});

  const loadEvent = async () => {
    try {
      setLoading(true);
      const [evt, recs] = await Promise.all([getEvent(eventId), getRecommendations(eventId)]);
      setEvent(evt);
      setRecommendations(recs);

      // Pre-select recommended templates
      const recIds = recs.filter((r) => r.recommended).map((r) => r.templateId);
      setSelectedTemplates(recIds.length > 0 ? recIds : [recs[0]?.templateId].filter(Boolean));

      // Populate local edits
      const initial: Record<string, FieldValue> = {};
      evt.fields.forEach((f) => {
        initial[f.key] = f.value;
      });
      setFieldEdits(initial);
    } catch (err: any) {
      toast.error(err.message || "Failed to load event for review");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const handleFieldChange = (key: string, value: FieldValue) => {
    setFieldEdits((prev) => ({ ...prev, [key]: value }));
  };

  const handleFieldBlur = async (key: string) => {
    try {
      const updated = await updateEventFields(eventId, { [key]: fieldEdits[key] });
      setEvent(updated);
      const recs = await getRecommendations(eventId);
      setRecommendations(recs);
    } catch (err) {
      // quiet sync error or toast
    }
  };

  const toggleTemplate = (templateId: string) => {
    setSelectedTemplates((prev) =>
      prev.includes(templateId) ? prev.filter((id) => id !== templateId) : [...prev, templateId]
    );
  };

  // Find missing required fields
  const requiredMissingFields = (event?.fields || []).filter(
    (f) => f.required && isEmptyValue(fieldEdits[f.key])
  );

  const isBlockedFromGeneration = requiredMissingFields.length > 0 && !allowPlaceholders;

  const handleGenerate = async () => {
    if (selectedTemplates.length === 0) {
      toast.error("Please select at least one document to generate.");
      return;
    }
    try {
      setGenerating(true);
      // Save any pending field edits first
      await updateEventFields(eventId, fieldEdits);
      const generated = await generateDocuments(eventId, selectedTemplates, { allowPlaceholders });
      toast.success(`Generated ${generated.length} documents successfully!`);
      if (generated.length > 0) {
        router.push(`/event/${eventId}/doc/${generated[0].id}`);
      } else {
        router.push(`/event/${eventId}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate documents");
      setGenerating(false);
    }
  };

  if (loading || !event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#4F81BD]" />
        <p className="text-sm text-slate-500 font-medium">Analyzing event requirements...</p>
      </div>
    );
  }

  const sections = groupBySection(event.fields);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Stepper currentStep="review" eventId={eventId} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F3A5F]">
            Review Extracted Information
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Event: <span className="font-semibold text-slate-900">{event.title}</span> · Chapter: ACM SVNIT
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/event/${eventId}`}>
            <Button variant="outline" size="sm" className="text-xs">
              View Event Hub
            </Button>
          </Link>
        </div>
      </div>

      {/* Amber "Needs your input" panel when required fields are missing */}
      {requiredMissingFields.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/70 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <CardTitle className="text-sm font-bold text-amber-900">
                Needs your input ({requiredMissingFields.length} required {requiredMissingFields.length === 1 ? "field" : "fields"} incomplete)
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-amber-800">
              Official institutional letters cannot leave these details empty unless you explicitly choose to generate with placeholders.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {requiredMissingFields.map((f) => (
                <div
                  key={f.key}
                  className="p-3 rounded-lg border border-amber-200 bg-white shadow-2xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-800">{f.label}</span>
                      <p className="text-[11px] text-amber-700 font-medium mt-0.5">{f.question}</p>
                    </div>
                    {f.sensitive ? (
                      <span className="text-[10px] uppercase font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                        Not provided (Sensitive)
                      </span>
                    ) : (
                      <FieldSourceBadge source={f.source} />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {f.sensitive ? (
                      <MaskedInput
                        id={`missing-${f.key}`}
                        value={(fieldEdits[f.key] as string) || ""}
                        onChange={(val) => handleFieldChange(f.key, val)}
                        placeholder={`Enter ${f.label.toLowerCase()}`}
                        className="h-8 text-xs bg-amber-50/30"
                      />
                    ) : (
                      <Input
                        id={`missing-${f.key}`}
                        value={(fieldEdits[f.key] as string) || ""}
                        onChange={(e) => handleFieldChange(f.key, e.target.value)}
                        onBlur={() => handleFieldBlur(f.key)}
                        placeholder={`Enter ${f.label.toLowerCase()}`}
                        className="h-8 text-xs bg-amber-50/30"
                      />
                    )}
                    {f.suggestion && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          handleFieldChange(f.key, f.suggestion!);
                          handleFieldBlur(f.key);
                        }}
                        className="h-8 text-[11px] shrink-0 bg-blue-50 text-[#1F3A5F] hover:bg-blue-100 border border-blue-200"
                        title="Accept suggested default"
                      >
                        Accept Suggestion
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Split Layout: Left = Extracted Fields Form | Right = Recommended Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Editable Form by Sections (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Extracted Fields & Sources</h2>
            <span className="text-xs text-slate-500">Auto-saves on exit</span>
          </div>

          <div className="space-y-6">
            {sections.map(([sectionName, fields]) => (
              <Card key={sectionName} className="border-slate-200 shadow-2xs">
                <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/60">
                  <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {sectionName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {fields.map((field) => {
                    const isSensitive = field.sensitive;
                    const val = fieldEdits[field.key];
                    const isText = field.type === "text" || field.type === "number" || field.type === "date" || field.type === "time";
                    const isLong = field.type === "longtext";

                    return (
                      <div key={field.key} className="space-y-1.5 pb-2 border-b border-slate-100 last:border-b-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label htmlFor={`field-${field.key}`} className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                            {field.label}
                            {field.required && <span className="text-red-500">*</span>}
                          </Label>
                          <div className="flex items-center gap-2">
                            {isSensitive ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                <Lock className="w-3 h-3 text-slate-400" />
                                {field.userConfirmed ? "Confirmed by you" : "Not provided"}
                              </span>
                            ) : (
                              <FieldSourceBadge
                                source={field.source}
                                confidence={field.confidence}
                                aiDraftable={field.aiDraftable}
                              />
                            )}
                          </div>
                        </div>

                        {field.helpText && (
                          <p className="text-[11px] text-slate-500">{field.helpText}</p>
                        )}

                        {isText && !isSensitive && (
                          <Input
                            id={`field-${field.key}`}
                            type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text"}
                            value={(val as string) || ""}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            onBlur={() => handleFieldBlur(field.key)}
                            placeholder={field.question}
                            className="text-xs"
                          />
                        )}

                        {isText && isSensitive && (
                          <MaskedInput
                            id={`field-${field.key}`}
                            value={(val as string) || ""}
                            onChange={(v) => handleFieldChange(field.key, v)}
                            placeholder={field.question}
                            className="text-xs"
                          />
                        )}

                        {isLong && (
                          <Textarea
                            id={`field-${field.key}`}
                            rows={3}
                            value={(val as string) || ""}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            onBlur={() => handleFieldBlur(field.key)}
                            placeholder={field.question}
                            className="text-xs leading-relaxed"
                          />
                        )}

                        {field.type === "table" && (
                          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 flex justify-between items-center">
                            <span>
                              {Array.isArray(val) ? `${val.length} rows configured` : "Table format"}
                            </span>
                            <span className="text-[11px] text-[#4F81BD] font-medium">
                              Editable row-by-row in Document Editor
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Column: Recommended Documents & Action (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sticky top-20 space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#4F81BD]" />
                  <span>Recommended Documents</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Templates automatically selected based on event category, room bookings, and expenses.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {recommendations.map((rec) => {
                  const isChecked = selectedTemplates.includes(rec.templateId);
                  return (
                    <div
                      key={rec.templateId}
                      onClick={() => toggleTemplate(rec.templateId)}
                      className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                        isChecked
                          ? "border-[#4F81BD] bg-blue-50/40 shadow-2xs"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <Checkbox
                        id={`rec-${rec.templateId}`}
                        checked={isChecked}
                        onCheckedChange={() => toggleTemplate(rec.templateId)}
                        className="mt-0.5 data-[state=checked]:bg-[#4F81BD] data-[state=checked]:border-[#4F81BD]"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor={`rec-${rec.templateId}`}
                            className="text-xs font-bold text-slate-800 cursor-pointer"
                          >
                            {rec.templateName}
                          </label>
                          {rec.recommended && (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">{rec.reason}</p>
                        {rec.missingKeys.length > 0 && (
                          <p className="text-[10px] text-amber-700 font-medium">
                            Missing {rec.missingKeys.length} required fields
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Placeholders check */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="flex items-start gap-2.5 p-2.5 rounded bg-slate-50 border border-slate-200">
                    <Checkbox
                      id="allow-placeholders"
                      checked={allowPlaceholders}
                      onCheckedChange={(checked) => setAllowPlaceholders(!!checked)}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor="allow-placeholders"
                        className="text-xs font-semibold text-slate-800 cursor-pointer"
                      >
                        Generate with placeholders
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Leave missing fields highlighted as <code className="bg-yellow-100 text-yellow-800 px-1 rounded">[TO BE FILLED]</code> in the generated letter.
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={generating || isBlockedFromGeneration || selectedTemplates.length === 0}
                    className="w-full bg-[#4F81BD] hover:bg-[#3d689b] text-white font-semibold py-5 text-sm gap-2 shadow-sm"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating {selectedTemplates.length} documents...</span>
                      </>
                    ) : (
                      <>
                        <span>Generate Selected Documents ({selectedTemplates.length})</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>

                  {isBlockedFromGeneration && (
                    <p className="text-[11px] text-center text-amber-700 font-medium">
                      Fill required fields on the left or enable &ldquo;Generate with placeholders&rdquo; to proceed.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
