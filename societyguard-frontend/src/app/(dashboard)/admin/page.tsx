"use client";

import { useAuth } from "@/hooks/useAuth";

export default function AdminDashboard() {
  const { user } = useAuth();
  
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Society Admin Dashboard</h1>
      <p className="text-gray-600">Manage your society operations, {user?.name}.</p>
    </div>
  );
}
