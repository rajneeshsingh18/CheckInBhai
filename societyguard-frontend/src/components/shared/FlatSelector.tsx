"use client";

import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAllSocietyFlats } from "@/lib/api";

interface Flat {
  id: string;
  number: string;
  tower: {
    name: string;
  };
}

interface FlatSelectorProps {
  selectedFlatId?: string;
  onSelect: (flatId: string, flatNumber: string) => void;
  className?: string;
  placeholder?: string;
}

export default function FlatSelector({ selectedFlatId, onSelect, className, placeholder = "Select a flat..." }: FlatSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: flats = [], isLoading } = useAllSocietyFlats();

  const selectedFlat = flats.find((f: Flat) => f.id === selectedFlatId);

  const filteredFlats = flats.filter((flat: Flat) => {
    const text = `${flat.tower?.name || ""} ${flat.number}`.toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center justify-between border border-gray-300 rounded-lg bg-white px-3 py-2 text-sm font-normal text-left text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-full",
          className
        )}
      >
        {selectedFlat ? (
          <span className="font-medium text-gray-900">
            {selectedFlat.tower?.name ? `${selectedFlat.tower.name} - ` : ""}Flat {selectedFlat.number}
          </span>
        ) : (
          <span className="text-gray-400">{isLoading ? "Loading flats..." : placeholder}</span>
        )}
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[280px] p-0 bg-white border border-gray-200 shadow-lg rounded-lg z-50">
        <div className="flex items-center border-b border-gray-100 px-3 py-2 bg-gray-50 rounded-t-lg">
          <Search className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
          <input
            type="text"
            className="w-full text-sm bg-transparent outline-none text-gray-800 placeholder-gray-400"
            placeholder="Search tower or flat number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[220px] overflow-y-auto py-1">
          {isLoading ? (
            <div className="py-6 text-center text-xs text-gray-400">Loading...</div>
          ) : filteredFlats.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">No flats found.</div>
          ) : (
            filteredFlats.map((flat: Flat) => {
              const label = `${flat.tower?.name ? `${flat.tower.name} - ` : ""}Flat ${flat.number}`;
              return (
                <button
                  key={flat.id}
                  type="button"
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-2 text-sm text-left transition-colors hover:bg-gray-100 text-gray-700",
                    flat.id === selectedFlatId && "bg-orange-50 text-orange-600 font-semibold"
                  )}
                  onClick={() => {
                    onSelect(flat.id, flat.number);
                    setOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <span>{label}</span>
                  {flat.id === selectedFlatId && <Check className="h-4 w-4 text-orange-600" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
