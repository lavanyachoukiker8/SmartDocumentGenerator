"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, FormInput, ArrowRight, Loader2, Calendar, MapPin, Users, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stepper } from "@/components/stepper";
import { createEventFromText, createEventFromForm } from "@/lib/api";
import type { EventCategory, EventFormInput, EventMode } from "@/lib/types";
import { toast } from "sonner";

export default function NewEventPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Tab 1: Describe it (Natural Language)
  const defaultPrompt =
    "We are conducting a two-day Web Development Workshop on 14–15 October in Seminar Hall for around 120 students";
  const [describeText, setDescribeText] = useState(defaultPrompt);

  // Tab 2: Fill a form (Structured)
  const [form, setForm] = useState<EventFormInput>({
    title: "",
    category: "workshop",
    startDate: "",
    endDate: "",
    startTime: "09:00",
    endTime: "17:00",
    venue: "",
    mode: "offline",
    participants: "",
    description: "",
    objective: "",
    organizers: "ACM Core 2026-27",
  });

  const handleDescribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!describeText.trim()) {
      toast.error("Please enter a description for your event.");
      return;
    }
    try {
      setSubmitting(true);
      const event = await createEventFromText(describeText);
      toast.success("Event analyzed! Reviewing extracted fields...");
      router.push(`/event/${event.id}/review`);
    } catch (err: any) {
      toast.error(err.message || "Failed to process event description");
      setSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Please enter an event title");
      return;
    }
    try {
      setSubmitting(true);
      const event = await createEventFromForm(form);
      toast.success("Event created! Reviewing document recommendations...");
      router.push(`/event/${event.id}/review`);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit event form");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <Stepper currentStep="describe" />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[#1F3A5F]">Create New Document Request</h1>
        <p className="text-sm text-slate-600">
          Provide your event details. You can paste a rough paragraph or enter a structured schedule.
        </p>
      </div>

      <Tabs defaultValue="describe" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-slate-200/80 p-1">
          <TabsTrigger value="describe" className="gap-2 text-xs font-semibold data-[state=active]:bg-white">
            <Sparkles className="w-3.5 h-3.5 text-[#4F81BD]" />
            <span>Describe it (AI Extract)</span>
          </TabsTrigger>
          <TabsTrigger value="form" className="gap-2 text-xs font-semibold data-[state=active]:bg-white">
            <FormInput className="w-3.5 h-3.5 text-slate-600" />
            <span>Fill a form</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab A: Natural Language Description */}
        <TabsContent value="describe" className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Natural Language Description</span>
                <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Fastest
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Type what you know: name, dates, venue, audience, budget or refreshments. We extract dates, timings, venues, and match official club templates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDescribeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    value={describeText}
                    onChange={(e) => setDescribeText(e.target.value)}
                    rows={6}
                    placeholder="We are conducting a two-day Web Development Workshop on 14–15 October in Seminar Hall for around 120 students..."
                    className="text-sm resize-y font-sans p-3 leading-relaxed focus-visible:ring-[#4F81BD]"
                  />
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                    <span className="flex items-center gap-1 text-slate-600">
                      <HelpCircle className="w-3.5 h-3.5 text-[#4F81BD]" />
                      Tip: Mentioning &ldquo;Seminar Hall&rdquo; or &ldquo;Lab&rdquo; will auto-recommend Room Permission.
                    </span>
                    <span>{describeText.length} characters</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={submitting || !describeText.trim()}
                    className="bg-[#4F81BD] hover:bg-[#3d689b] text-white font-medium gap-2 px-6"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Extracting details...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue to Review</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab B: Structured Form */}
        <TabsContent value="form" className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900">
                Structured Event Form
              </CardTitle>
              <CardDescription className="text-xs">
                Enter precise values for all standard fields.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="title" className="text-xs font-semibold">Event Title *</Label>
                    <Input
                      id="title"
                      required
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Web Development Workshop 2026"
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="category" className="text-xs font-semibold">Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(val) => {
                        if (val) setForm({ ...form, category: val as EventCategory });
                      }}
                    >
                      <SelectTrigger id="category" className="text-xs">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="workshop">Workshop</SelectItem>
                        <SelectItem value="hackathon">Hackathon</SelectItem>
                        <SelectItem value="competition">Competition</SelectItem>
                        <SelectItem value="seminar">Seminar</SelectItem>
                        <SelectItem value="talk">Technical Talk</SelectItem>
                        <SelectItem value="meeting">Meeting / Discussion</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="startDate" className="text-xs font-semibold">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      required
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="endDate" className="text-xs font-semibold">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="startTime" className="text-xs font-semibold">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="endTime" className="text-xs font-semibold">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="venue" className="text-xs font-semibold">Venue / Room</Label>
                    <Input
                      id="venue"
                      value={form.venue}
                      onChange={(e) => setForm({ ...form, venue: e.target.value })}
                      placeholder="e.g. Seminar Hall 402, CSE Dept."
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="mode" className="text-xs font-semibold">Mode</Label>
                    <Select
                      value={form.mode}
                      onValueChange={(val) => {
                        if (val) setForm({ ...form, mode: val as EventMode });
                      }}
                    >
                      <SelectTrigger id="mode" className="text-xs">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="offline">Offline</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="participants" className="text-xs font-semibold">Expected Participants</Label>
                    <Input
                      id="participants"
                      value={form.participants}
                      onChange={(e) => setForm({ ...form, participants: e.target.value })}
                      placeholder="e.g. 120"
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs font-semibold">Brief Description</Label>
                  <Textarea
                    id="description"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Provide a short overview of what will be taught or done..."
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="objective" className="text-xs font-semibold">Objective</Label>
                  <Textarea
                    id="objective"
                    rows={2}
                    value={form.objective}
                    onChange={(e) => setForm({ ...form, objective: e.target.value })}
                    placeholder="Key takeaway or learning goal..."
                    className="text-xs"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#4F81BD] hover:bg-[#3d689b] text-white font-medium gap-2 px-6"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit to Review</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
