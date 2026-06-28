"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ActionItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "secondary";
}

interface ActionSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  actions: ActionItem[];
}

export default function ActionSheet({ isOpen, onOpenChange, title, description, actions }: ActionSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-5 bg-white border-t border-gray-200">
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="text-lg font-bold text-gray-900">{title}</SheetTitle>
          {description && <SheetDescription className="text-sm text-gray-500">{description}</SheetDescription>}
        </SheetHeader>

        <div className="space-y-2">
          {actions.map((action, idx) => {
            const isDestructive = action.variant === "destructive";
            const isSecondary = action.variant === "secondary";
            
            return (
              <button
                key={idx}
                onClick={() => {
                  action.onClick();
                  onOpenChange(false);
                }}
                className={`w-full flex items-center justify-center py-3.5 px-4 rounded-xl text-sm font-semibold transition-colors ${
                  isDestructive
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : isSecondary
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-orange-50 text-orange-700 hover:bg-orange-100"
                }`}
              >
                {action.icon && <span className="mr-2.5">{action.icon}</span>}
                {action.label}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
