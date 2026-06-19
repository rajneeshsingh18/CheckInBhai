"use client";

import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useRequireRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function GuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useRequireRole(["GUARD"], "/login");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
