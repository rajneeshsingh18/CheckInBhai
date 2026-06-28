"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  className?: string;
}

export default function DateRangePicker({ startDate, endDate, onChange, className }: DateRangePickerProps) {
  return (
    <div className={`grid grid-cols-2 gap-4 bg-white p-3 rounded-lg border border-gray-200 shadow-sm ${className}`}>
      <div>
        <Label htmlFor="start-date" className="text-xs font-semibold text-gray-500 mb-1 block">
          From Date
        </Label>
        <Input
          type="date"
          id="start-date"
          value={startDate}
          onChange={(e) => onChange(e.target.value, endDate)}
          className="text-sm border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 w-full"
        />
      </div>
      <div>
        <Label htmlFor="end-date" className="text-xs font-semibold text-gray-500 mb-1 block">
          To Date
        </Label>
        <Input
          type="date"
          id="end-date"
          value={endDate}
          onChange={(e) => onChange(startDate, e.target.value)}
          className="text-sm border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 w-full"
        />
      </div>
    </div>
  );
}
