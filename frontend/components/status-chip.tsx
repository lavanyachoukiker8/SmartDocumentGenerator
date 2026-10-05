import { Badge } from "@/components/ui/badge";
import type { Status } from "@/lib/types";
import { CheckCircle2, Clock, AlertTriangle, FileCheck } from "lucide-react";

interface StatusChipProps {
  status: Status;
  size?: "sm" | "default";
}

export function StatusChip({ status, size = "default" }: StatusChipProps) {
  const configs: Record<
    Status,
    { label: string; icon: any; className: string }
  > = {
    draft: {
      label: "Draft",
      icon: Clock,
      className: "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200",
    },
    needs_info: {
      label: "Needs info",
      icon: AlertTriangle,
      className: "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100",
    },
    ready: {
      label: "Ready",
      icon: CheckCircle2,
      className: "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100",
    },
    approved: {
      label: "Approved",
      icon: FileCheck,
      className: "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100",
    },
  };

  const config = configs[status] || configs.draft;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1.5 font-medium border ${config.className} ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      <span>{config.label}</span>
    </Badge>
  );
}
