"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export default function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isLoading = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white border border-gray-200 rounded-lg p-5">
        <DialogHeader className="mb-3">
          <DialogTitle className="text-lg font-bold text-gray-900">{title}</DialogTitle>
          <DialogDescription className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm"
          >
            {isLoading ? "Processing..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
