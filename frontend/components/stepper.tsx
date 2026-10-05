"use client";

import { CheckCircle2, ChevronRight, Circle, FileEdit, Sparkles, Send } from "lucide-react";
import Link from "next/link";

interface StepperProps {
  currentStep: "describe" | "review" | "edit" | "export";
  eventId?: string;
  docId?: string;
}

export function Stepper({ currentStep, eventId, docId }: StepperProps) {
  const steps = [
    {
      id: "describe",
      label: "1. Describe",
      description: "Natural language or structured form",
      href: "/new",
      isComplete: currentStep !== "describe",
      isCurrent: currentStep === "describe",
    },
    {
      id: "review",
      label: "2. Review",
      description: "Field confidence & recommended docs",
      href: eventId ? `/event/${eventId}/review` : undefined,
      isComplete: currentStep === "edit" || currentStep === "export",
      isCurrent: currentStep === "review",
    },
    {
      id: "edit",
      label: "3. Edit & Preview",
      description: "A4 live letterhead & shared fields",
      href: eventId && docId ? `/event/${eventId}/doc/${docId}` : undefined,
      isComplete: currentStep === "export",
      isCurrent: currentStep === "edit",
    },
    {
      id: "export",
      label: "4. Export",
      description: "DOCX / PDF with signatories",
      href: eventId && docId ? `/event/${eventId}/doc/${docId}` : undefined,
      isComplete: false,
      isCurrent: currentStep === "export",
    },
  ];

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-4 shadow-2xs mb-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {steps.map((step, idx) => {
          const content = (
            <div className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                  step.isComplete
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                    : step.isCurrent
                    ? "bg-[#4F81BD] text-white ring-4 ring-blue-100"
                    : "bg-slate-100 text-slate-400 border border-slate-200"
                }`}
              >
                {step.isComplete ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
              </div>
              <div>
                <p
                  className={`text-xs font-bold leading-tight ${
                    step.isCurrent
                      ? "text-[#1F3A5F]"
                      : step.isComplete
                      ? "text-slate-700"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-[11px] text-slate-500 hidden sm:block">{step.description}</p>
              </div>
            </div>
          );

          return (
            <div key={step.id} className="flex items-center gap-3 flex-1">
              {step.href ? (
                <Link href={step.href} className="hover:opacity-80 transition-opacity">
                  {content}
                </Link>
              ) : (
                content
              )}
              {idx < steps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-slate-300 hidden md:block ml-auto shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
