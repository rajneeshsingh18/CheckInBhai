"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  onSearch: (value: string) => void;
  placeholder?: string;
  className?: string;
  initialValue?: string;
  debounceMs?: number;
}

export default function SearchBar({
  onSearch,
  placeholder = "Search...",
  className,
  initialValue = "",
  debounceMs = 350,
}: SearchBarProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(value);
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, onSearch, debounceMs]);

  const clearSearch = () => {
    setValue("");
    onSearch("");
  };

  return (
    <div className={`relative flex items-center w-full max-w-md ${className}`}>
      <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
      <Input
        type="text"
        className="pl-9 pr-9 w-full bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm py-2"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {value && (
        <button
          onClick={clearSearch}
          className="absolute right-3 p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
