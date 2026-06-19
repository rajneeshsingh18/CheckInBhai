"use client";

import { useAuth } from "@/hooks/useAuth";

export default function GuardDashboard() {
  const { user } = useAuth();
  
  return (
    <div className="p-4 sm:p-6 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Guard Dashboard</h1>
      <p className="text-gray-600">Welcome back, {user?.name}. Your shift has started.</p>
    </div>
  );
}
