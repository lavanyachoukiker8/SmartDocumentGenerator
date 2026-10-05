import { Badge } from "@/components/ui/badge";
import type { FieldSource } from "@/lib/types";
import { Sparkles, User, ShieldAlert, Building2 } from "lucide-react";

interface FieldSourceBadgeProps {
  source: FieldSource;
  confidence?: number;
  aiDraftable?: boolean;
}

export function FieldSourceBadge({ source, confidence, aiDraftable }: FieldSourceBadgeProps) {
  switch (source) {
    case "user_text":
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] gap-1 py-0">
          <User className="w-3 h-3" />
          <span>From your text</span>
          {confidence ? <span className="text-[10px] text-emerald-600/80">({Math.round(confidence * 100)}%)</span> : null}
        </Badge>
      );
    case "club_profile":
      return (
        <Badge variant="outline" className="bg-blue-50 text-[#1F3A5F] border-blue-200 text-[11px] gap-1 py-0">
          <Building2 className="w-3 h-3 text-[#4F81BD]" />
          <span>From club profile</span>
        </Badge>
      );
    case "ai_draft":
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[11px] gap-1 py-0">
          <Sparkles className="w-3 h-3 text-purple-500" />
          <span>AI draft - review</span>
        </Badge>
      );
    case "missing":
    default:
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] gap-1 py-0">
          <ShieldAlert className="w-3 h-3 text-amber-600" />
          <span>Missing</span>
        </Badge>
      );
  }
}
