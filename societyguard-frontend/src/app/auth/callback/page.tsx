"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // The backend sends the data in the URL hash fragment: #data=base64...
        const hash = window.location.hash;
        if (!hash || !hash.includes("data=")) {
          throw new Error("No authentication data found in URL");
        }

        const encodedData = hash.replace("#data=", "");
        
        // Fix Base64URL encoding (convert to standard Base64)
        const base64 = encodedData.replace(/-/g, "+").replace(/_/g, "/");
        const padding = "=".repeat((4 - (base64.length % 4)) % 4);
        const jsonStr = atob(base64 + padding);
        
        const payload = JSON.parse(jsonStr);

        if (!payload.accessToken || !payload.user) {
          throw new Error("Invalid authentication payload");
        }

        // Store auth state
        login({
          user: payload.user,
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
        });

        if (payload.isNewUser) {
          toast.success("Welcome to Rakshak!");
        } else {
          toast.success("Logged in successfully via Google!");
        }

        // Redirect to dashboard based on role
        const role = payload.user.role.toLowerCase().replace("_", "-");
        router.push(`/${role}`);
      } catch (error: unknown) {
        const err = error as { message?: string };
        console.error("OAuth error:", err);
        setError(err.message || "Failed to authenticate with Google");
        toast.error("Authentication failed. Please try again.");
        
        // Redirect to login after a delay
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    };
    
    handleAuth();
  }, [login, router]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h1>
        <p className="text-gray-500 mb-6 text-center max-w-md">{error}</p>
        <button 
          onClick={() => router.push("/login")}
          className="px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
        >
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <Loader2 className="w-12 h-12 text-orange-600 animate-spin mb-4" />
      <h2 className="text-xl font-semibold text-gray-900">Completing Sign In...</h2>
      <p className="text-gray-500 mt-2">Please wait while we set up your account securely.</p>
    </div>
  );
}
