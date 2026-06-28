"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface LoadingSkeletonProps {
  type?: "card" | "list" | "stat" | "table";
  count?: number;
  className?: string;
}

export default function LoadingSkeleton({ type = "card", count = 3, className }: LoadingSkeletonProps) {
  const items = Array.from({ length: count });

  if (type === "stat") {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
        {items.map((_, i) => (
          <div key={i} className="border border-gray-200 bg-white p-5 rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-24 bg-gray-200" />
              <Skeleton className="h-9 w-9 rounded-lg bg-gray-200" />
            </div>
            <Skeleton className="h-8 w-16 bg-gray-200" />
            <Skeleton className="h-3.5 w-32 bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "list") {
    return (
      <div className={`space-y-3 ${className}`}>
        {items.map((_, i) => (
          <div key={i} className="flex items-center space-x-4 border border-gray-200 bg-white p-4 rounded-lg">
            <Skeleton className="h-10 w-10 rounded-full bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3 bg-gray-200" />
              <Skeleton className="h-3 w-1/2 bg-gray-200" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className={`border border-gray-200 rounded-lg overflow-hidden bg-white ${className}`}>
        <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between">
          <Skeleton className="h-4 w-24 bg-gray-200" />
          <Skeleton className="h-4 w-32 bg-gray-200" />
        </div>
        <div className="p-4 space-y-4">
          {items.map((_, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <Skeleton className="h-4 w-1/4 bg-gray-200" />
              <Skeleton className="h-4 w-1/5 bg-gray-200" />
              <Skeleton className="h-4 w-1/6 bg-gray-200" />
              <Skeleton className="h-4 w-12 bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Card Grid (default)
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {items.map((_, i) => (
        <div key={i} className="border border-gray-200 bg-white p-5 rounded-lg space-y-4">
          <div className="flex items-start space-x-4">
            <Skeleton className="h-12 w-12 rounded-full bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-1/2 bg-gray-200" />
                <Skeleton className="h-5 w-16 rounded bg-gray-200" />
              </div>
              <Skeleton className="h-3 w-1/3 bg-gray-200" />
              <Skeleton className="h-3.5 w-3/4 bg-gray-200" />
            </div>
          </div>
          <div className="pt-3 border-t border-gray-100 flex justify-between">
            <Skeleton className="h-3 w-24 bg-gray-200" />
            <Skeleton className="h-3 w-16 bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
