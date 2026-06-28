"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  className?: string;
  onClick?: () => void;
  trend?: {
    value: string | number;
    isPositive: boolean;
  };
}

export default function StatCard({ label, value, icon, description, className, onClick, trend }: StatCardProps) {
  return (
    <Card 
      onClick={onClick}
      className={cn(
        "overflow-hidden border border-gray-200 bg-white transition-all shadow-sm",
        onClick && "cursor-pointer hover:shadow-md hover:border-gray-300 active:scale-[0.99]",
        className
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-500 tracking-wide uppercase">{label}</span>
          <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-100/50">
            {icon}
          </div>
        </div>

        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-gray-900 tracking-tight">{value}</span>
          {trend && (
            <span className={cn(
              "text-xs font-semibold px-1.5 py-0.5 rounded",
              trend.isPositive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            )}>
              {trend.isPositive ? "+" : ""}{trend.value}
            </span>
          )}
        </div>

        {(description || trend) && (
          <p className="mt-2.5 text-xs font-medium text-gray-500 truncate">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
