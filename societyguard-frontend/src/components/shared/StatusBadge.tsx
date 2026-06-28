"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const normStatus = status.toUpperCase();

  const getStyle = () => {
    switch (normStatus) {
      // Visitor / Entry status
      case "APPROVED":
        return "bg-green-100 text-green-800 hover:bg-green-100 border-green-200";
      case "REJECTED":
        return "bg-red-100 text-red-800 hover:bg-red-100 border-red-200";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200 animate-pulse";
      case "EXITED":
        return "bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200";
      case "PRE_APPROVED":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200";
      case "CANCELLED":
        return "bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200";

      // Delivery status
      case "RECEIVED":
        return "bg-indigo-100 text-indigo-800 hover:bg-indigo-100 border-indigo-200";
      case "NOTIFIED":
        return "bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200";
      case "PICKED_UP":
        return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200";
      case "RETURNED":
        return "bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200";

      // Staff status
      case "ON_TIME":
        return "bg-green-100 text-green-800 hover:bg-green-100 border-green-200";
      case "LATE":
        return "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200";
      case "ABSENT":
        return "bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200";

      // Default fallback
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200";
    }
  };

  const getLabel = () => {
    return status.replace(/_/g, " ");
  };

  return (
    <Badge variant="outline" className={cn("px-2 py-0.5 text-xs font-semibold capitalize", getStyle(), className)}>
      {getLabel()}
    </Badge>
  );
}
