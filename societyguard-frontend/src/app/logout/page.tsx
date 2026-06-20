"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/useAuth";

export default function LogoutPage() {
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    logout();
  }, [logout]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-lg font-medium text-gray-600">Logging out...</p>
      </div>
    </div>
  );
}
