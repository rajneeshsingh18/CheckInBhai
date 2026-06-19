"use client";

import { useAuth } from "@/hooks/useAuth";

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Super Admin Dashboard</h1>
      <p className="text-gray-600">Platform overview and management for {user?.name}.</p>
    </div>
  );
}
