"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between px-2 py-3 bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      <div className="flex-1 flex justify-between sm:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="text-xs font-semibold text-gray-700 border-gray-300"
        >
          Previous
        </Button>
        <div className="flex items-center text-xs font-semibold text-gray-500">
          Page {currentPage} of {totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="text-xs font-semibold text-gray-700 border-gray-300"
        >
          Next
        </Button>
      </div>

      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between w-full">
        <div>
          <p className="text-sm text-gray-500">
            Showing Page <span className="font-semibold text-gray-800">{currentPage}</span> of{" "}
            <span className="font-semibold text-gray-800">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-l-md border-gray-300 text-gray-500 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              const isCurrent = page === currentPage;
              return (
                <Button
                  key={page}
                  variant={isCurrent ? "default" : "outline"}
                  onClick={() => onPageChange(page)}
                  className={`border-gray-300 ${
                    isCurrent
                      ? "bg-orange-600 hover:bg-orange-700 text-white font-bold"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {page}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="rounded-r-md border-gray-300 text-gray-500 hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </div>
    </div>
  );
}
