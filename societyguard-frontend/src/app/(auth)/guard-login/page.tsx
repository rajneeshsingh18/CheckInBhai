"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import api from "@/lib/api";
import { Loader2, Building, UserSquare, KeyRound } from "lucide-react";
import { useAuthStore } from "@/stores/useAuth";

const guardLoginSchema = z.object({
  societyId: z.string().min(1, "Society ID is required"),
  guardId: z.string().min(1, "Guard ID is required"),
  pinCode: z.string().length(6, "PIN must be exactly 6 digits"),
});

type GuardLoginFormValues = z.infer<typeof guardLoginSchema>;

export default function GuardLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<GuardLoginFormValues>({
    resolver: zodResolver(guardLoginSchema),
  });

  useEffect(() => {
    const savedSocietyId = localStorage.getItem("rakshak_society_id");
    if (savedSocietyId) {
      setValue("societyId", savedSocietyId);
    }
  }, [setValue]);

  const onSubmit = async (data: GuardLoginFormValues) => {
    try {
      setIsLoading(true);
      const response = await api.post("/auth/guard/login", {
        societyId: data.societyId,
        guardId: data.guardId,
        pin: data.pinCode,
      });
      
      // Save society ID for next time
      localStorage.setItem("rakshak_society_id", data.societyId);
      
      login({
        user: response.data.user,
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      });
      
      toast.success("Login successful!");
      router.push("/guard");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Guard Portal</h1>
          <p className="text-gray-500 mt-2 text-lg">Enter your details to start duty</p>
        </div>

        <Card className="border-0 shadow-2xl shadow-black/10 rounded-3xl overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="space-y-2">
                <Label htmlFor="societyId" className="text-base text-gray-700">Society ID</Label>
                <div className="relative">
                  <Building className="absolute left-4 top-4 text-gray-400 w-6 h-6" />
                  <Input
                    id="societyId"
                    placeholder="E.g. SOC123"
                    {...register("societyId")}
                    className={`h-14 pl-12 text-lg rounded-xl bg-gray-50 ${errors.societyId ? "border-red-500" : "border-gray-200"}`}
                    disabled={isLoading}
                  />
                </div>
                {errors.societyId && <p className="text-sm text-red-500 pl-1">{errors.societyId.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="guardId" className="text-base text-gray-700">Guard ID</Label>
                <div className="relative">
                  <UserSquare className="absolute left-4 top-4 text-gray-400 w-6 h-6" />
                  <Input
                    id="guardId"
                    placeholder="E.g. GRD456"
                    {...register("guardId")}
                    className={`h-14 pl-12 text-lg rounded-xl bg-gray-50 ${errors.guardId ? "border-red-500" : "border-gray-200"}`}
                    disabled={isLoading}
                  />
                </div>
                {errors.guardId && <p className="text-sm text-red-500 pl-1">{errors.guardId.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pinCode" className="text-base text-gray-700">6-Digit PIN</Label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-4 text-gray-400 w-6 h-6" />
                  <Input
                    id="pinCode"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="●●●●●●"
                    {...register("pinCode")}
                    className={`h-14 pl-12 text-2xl tracking-widest rounded-xl bg-gray-50 ${errors.pinCode ? "border-red-500" : "border-gray-200"}`}
                    disabled={isLoading}
                  />
                </div>
                {errors.pinCode && <p className="text-sm text-red-500 pl-1">{errors.pinCode.message}</p>}
              </div>

              <Button
                type="submit"
                className="w-full h-16 text-lg rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/30 transition-all mt-4"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Login & Start Duty"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <div className="text-center mt-8">
          <Link href="/login" className="text-base font-medium text-gray-500 hover:text-gray-900 transition-colors bg-white px-6 py-3 rounded-full shadow-sm border border-gray-200 inline-block">
            &larr; Back to Main Login
          </Link>
        </div>
      </div>
    </div>
  );
}
