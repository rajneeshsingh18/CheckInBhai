"use client";

import { useAuth } from "@/hooks/useAuth";

export default function ResidentDashboard() {
  const { user } = useAuth();
  
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Resident Dashboard</h1>
      <p className="text-gray-600">Welcome to your home, {user?.name}.</p>
    </div>
  );
}
