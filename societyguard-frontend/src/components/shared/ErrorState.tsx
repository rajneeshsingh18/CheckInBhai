"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorState({ message = "Something went wrong. Please try again.", onRetry, className }: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-red-50/50 border border-red-200 rounded-xl ${className}`}>
      <div className="p-3 bg-red-100 rounded-full text-red-600 mb-3.5">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1">Error Loading Data</h3>
      <p className="text-sm text-gray-600 max-w-sm mb-4 leading-relaxed">{message}</p>
      {onRetry && (
        <Button 
          variant="outline" 
          onClick={onRetry}
          className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 font-semibold"
        >
          <RotateCcw className="w-4 h-4 mr-2" /> Retry
        </Button>
      )}
    </div>
  );
}
