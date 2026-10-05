"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Settings,
  Save,
  Plus,
  Trash2,
  Building,
  Hash,
  Users,
  Palette,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getClub, updateClub } from "@/lib/api";
import { useUserRole } from "@/lib/useRole";
import type { Club, ReferenceFormat, Signatory } from "@/lib/types";
import { toast } from "sonner";

export default function ClubSettingsPage() {
  const { role } = useUserRole();
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadClub = async () => {
    try {
      setLoading(true);
      const data = await getClub();
      setClub(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load club settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClub();
  }, []);

  const handleSave = async () => {
    if (!club) return;
    try {
      setSaving(true);
      const updated = await updateClub(club);
      setClub(updated);
      toast.success("Club settings and branding updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Signatories handlers
  const handleAddSignatory = () => {
    if (!club) return;
    const newSig: Signatory = {
      id: `sig-${Date.now()}`,
      name: "",
      shortName: "",
      designation: "",
      role: "Executive Member",
    };
    setClub({ ...club, signatories: [...club.signatories, newSig] });
  };

  const handleUpdateSignatory = (id: string, patch: Partial<Signatory>) => {
    if (!club) return;
    setClub({
      ...club,
      signatories: club.signatories.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const handleRemoveSignatory = (id: string) => {
    if (!club) return;
    setClub({
      ...club,
      signatories: club.signatories.filter((s) => s.id !== id),
    });
  };

  // Reference Format handlers
  const handleUpdateRefFormat = (cat: string, patch: Partial<ReferenceFormat>) => {
    if (!club) return;
    setClub({
      ...club,
      referenceFormats: club.referenceFormats.map((f) => (f.category === cat ? { ...f, ...patch } : f)),
    });
  };

  if (loading || !club) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-slate-500 font-medium">Loading club profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F3A5F]">Club Settings</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Configure institutional letterhead branding, default authorities, signatories, and reference numbering formats.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || role === "member"}
          title={role === "member" ? "Only Admin can save club settings" : undefined}
          className={`text-white text-xs gap-1.5 font-semibold ${
            role === "member" ? "bg-slate-400 cursor-not-allowed" : "bg-[#4F81BD] hover:bg-[#3d689b]"
          }`}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>Save Changes</span>
        </Button>
      </div>

      {role === "member" && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-900">
          <span className="font-semibold">Member View:</span>
          <span>You are viewing club settings in read-only mode. To modify branding, reference formats, and signatories, switch to the Admin role in the top navigation bar.</span>
        </div>
      )}

      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-xl bg-slate-200/80 p-1">
          <TabsTrigger value="branding" className="text-xs font-semibold data-[state=active]:bg-white">
            Branding & Letterhead
          </TabsTrigger>
          <TabsTrigger value="signatories" className="text-xs font-semibold data-[state=active]:bg-white">
            Signatories ({club.signatories.length})
          </TabsTrigger>
          <TabsTrigger value="references" className="text-xs font-semibold data-[state=active]:bg-white">
            Reference Formats
          </TabsTrigger>
          <TabsTrigger value="general" className="text-xs font-semibold data-[state=active]:bg-white">
            Academic Years
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Branding */}
        <TabsContent value="branding" className="space-y-4 mt-4">
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#4F81BD]" />
                <span>Letterhead Logos & Colors</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Official headers shown at the top of A4 previews and generated DOCX / PDF outputs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Left Logo (Club)</Label>
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50">
                    <div className="relative w-12 h-12 bg-white border rounded p-1">
                      <Image src={club.branding.logoLeft} alt="Club Logo" fill className="object-contain" />
                    </div>
                    <Input
                      value={club.branding.logoLeft}
                      onChange={(e) =>
                        setClub({
                          ...club,
                          branding: { ...club.branding, logoLeft: e.target.value },
                        })
                      }
                      className="text-xs"
                      placeholder="Public URL or path"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Right Logo (Institute)</Label>
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50">
                    <div className="relative w-12 h-12 bg-white border rounded p-1">
                      <Image src={club.branding.logoRight} alt="Institute Logo" fill className="object-contain" />
                    </div>
                    <Input
                      value={club.branding.logoRight}
                      onChange={(e) =>
                        setClub({
                          ...club,
                          branding: { ...club.branding, logoRight: e.target.value },
                        })
                      }
                      className="text-xs"
                      placeholder="Public URL or path"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Primary Brand Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={club.branding.primaryColor}
                      onChange={(e) =>
                        setClub({
                          ...club,
                          branding: { ...club.branding, primaryColor: e.target.value },
                        })
                      }
                      className="w-8 h-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={club.branding.primaryColor}
                      onChange={(e) =>
                        setClub({
                          ...club,
                          branding: { ...club.branding, primaryColor: e.target.value },
                        })
                      }
                      className="text-xs font-mono"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">ACM Blue: #4F81BD</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Dark Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={club.branding.darkColor}
                      onChange={(e) =>
                        setClub({
                          ...club,
                          branding: { ...club.branding, darkColor: e.target.value },
                        })
                      }
                      className="w-8 h-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={club.branding.darkColor}
                      onChange={(e) =>
                        setClub({
                          ...club,
                          branding: { ...club.branding, darkColor: e.target.value },
                        })
                      }
                      className="text-xs font-mono"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">Dark Blue: #1F3A5F</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-semibold">Letterhead Title (Serif Heading)</Label>
                <Input
                  value={club.branding.letterheadTitle}
                  onChange={(e) =>
                    setClub({
                      ...club,
                      branding: { ...club.branding, letterheadTitle: e.target.value },
                    })
                  }
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Letterhead Subtitle</Label>
                <Input
                  value={club.branding.letterheadSubtitle}
                  onChange={(e) =>
                    setClub({
                      ...club,
                      branding: { ...club.branding, letterheadSubtitle: e.target.value },
                    })
                  }
                  className="text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Signatories */}
        <TabsContent value="signatories" className="space-y-4 mt-4">
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#4F81BD]" />
                  <span>Club Signatories</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Officers and faculty chairman who sign letters and bills.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddSignatory}
                className="text-xs gap-1 border-slate-300"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Signatory</span>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {club.signatories.map((sig) => (
                <div
                  key={sig.id}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center"
                >
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-slate-500 font-semibold">Full Name</Label>
                    <Input
                      value={sig.name}
                      onChange={(e) => handleUpdateSignatory(sig.id, { name: e.target.value })}
                      className="text-xs h-8 bg-white"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-slate-500 font-semibold">Designation</Label>
                    <Input
                      value={sig.designation}
                      onChange={(e) => handleUpdateSignatory(sig.id, { designation: e.target.value })}
                      className="text-xs h-8 bg-white"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-slate-500 font-semibold">Role / Position</Label>
                    <Input
                      value={sig.role}
                      onChange={(e) => handleUpdateSignatory(sig.id, { role: e.target.value })}
                      className="text-xs h-8 bg-white"
                    />
                  </div>
                  <div className="flex items-center justify-end pt-3 sm:pt-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSignatory(sig.id)}
                      className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Reference Formats */}
        <TabsContent value="references" className="space-y-4 mt-4">
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Hash className="w-4 h-4 text-[#4F81BD]" />
                <span>Reference Number Formats & Counters</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Tokens: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">&#123;FY&#125;</code> (e.g. 26-27), <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">&#123;seq&#125;</code> (e.g. 009), <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">&#123;CLUB&#125;</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {club.referenceFormats.map((rf) => (
                <div
                  key={rf.category}
                  className="p-3 rounded-lg border border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3 items-center"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-800">{rf.category}</span>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Next: {rf.pattern.replace("{FY}", club.financialYear).replace("{seq}", String(rf.counter + 1).padStart(3, "0"))}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-slate-500 font-semibold">Pattern</Label>
                    <Input
                      value={rf.pattern}
                      onChange={(e) => handleUpdateRefFormat(rf.category, { pattern: e.target.value })}
                      className="text-xs h-8 font-mono"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-slate-500 font-semibold">Current Counter (last used)</Label>
                    <Input
                      type="number"
                      value={rf.counter}
                      onChange={(e) => handleUpdateRefFormat(rf.category, { counter: parseInt(e.target.value) || 0 })}
                      className="text-xs h-8 font-mono"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: General */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-4 h-4 text-[#4F81BD]" />
                <span>Chapter & Academic Year</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Academic Year</Label>
                  <Input
                    value={club.academicYear}
                    onChange={(e) => setClub({ ...club, academicYear: e.target.value })}
                    placeholder="2026-27"
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Financial Year (Short)</Label>
                  <Input
                    value={club.financialYear}
                    onChange={(e) => setClub({ ...club, financialYear: e.target.value })}
                    placeholder="26-27"
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Default &ldquo;Submitted to&rdquo; Authority</Label>
                <Input
                  value={club.defaultSubmittedTo}
                  onChange={(e) => setClub({ ...club, defaultSubmittedTo: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Institute Name</Label>
                  <Input
                    value={club.institute}
                    onChange={(e) => setClub({ ...club, institute: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Department</Label>
                  <Input
                    value={club.department}
                    onChange={(e) => setClub({ ...club, department: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
