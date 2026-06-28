"use client";

import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTabId: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export default function TabNavigation({ tabs, activeTabId, onChange, className }: TabNavigationProps) {
  return (
    <div className={cn("border-b border-gray-200 w-full mb-5", className)}>
      <nav className="flex space-x-6 -mb-px overflow-x-auto no-scrollbar" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "flex items-center py-3.5 px-1 border-b-2 font-semibold text-sm whitespace-nowrap transition-colors focus:outline-none",
                isActive
                  ? "border-orange-500 text-orange-600 font-bold"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.icon && <span className={cn("mr-2", isActive ? "text-orange-600" : "text-gray-400")}>{tab.icon}</span>}
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
