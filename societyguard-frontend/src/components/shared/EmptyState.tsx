"use client";

import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({ title, description, icon: Icon, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-gray-50 border border-dashed border-gray-300 rounded-2xl ${className}`}>
      <div className="p-4 bg-orange-50 border border-orange-100 rounded-full text-orange-600 mb-4 animate-bounce duration-1000">
        {Icon ? <Icon className="w-8 h-8" /> : <div className="w-8 h-8 bg-orange-300 rounded-full" />}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-5 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button 
          onClick={onAction}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-sm transition-all"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
