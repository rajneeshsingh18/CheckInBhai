"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import api from "@/lib/api";
import { Loader2, ArrowLeft } from "lucide-react";

const emailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

type EmailFormValues = z.infer<typeof emailSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    formState: { errors: emailErrors },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
  });

  const {
    register: registerReset,
    handleSubmit: handleSubmitReset,
    formState: { errors: resetErrors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
  });

  const onEmailSubmit = async (data: EmailFormValues) => {
    try {
      setIsLoading(true);
      await api.post("/auth/forgot-password", { email: data.email });
      setEmail(data.email);
      setStep(2);
      toast.success("OTP sent to your email!");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const onResetSubmit = async (data: ResetFormValues) => {
    try {
      setIsLoading(true);
      await api.post("/auth/reset-password", {
        email,
        otp: data.otp,
        newPassword: data.newPassword,
      });
      toast.success("Password reset successfully!");
      router.push("/login");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Forgot Password</h1>
          <p className="text-gray-500 mt-2">
            {step === 1 ? "Enter your email to receive an OTP" : "Enter the OTP and your new password"}
          </p>
        </div>

        <Card className="border-0 shadow-xl shadow-black/5 rounded-2xl">
          <CardContent className="pt-6">
            {step === 1 ? (
              <form onSubmit={handleSubmitEmail(onEmailSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    {...registerEmail("email")}
                    className={emailErrors.email ? "border-red-500" : ""}
                    disabled={isLoading}
                  />
                  {emailErrors.email && (
                    <p className="text-sm text-red-500">{emailErrors.email.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white transition-all mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send OTP
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmitReset(onResetSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">6-Digit OTP</Label>
                  <Input
                    id="otp"
                    placeholder="●●●●●●"
                    maxLength={6}
                    {...registerReset("otp")}
                    className={resetErrors.otp ? "border-red-500 text-center tracking-widest text-lg" : "text-center tracking-widest text-lg"}
                    disabled={isLoading}
                  />
                  {resetErrors.otp && (
                    <p className="text-sm text-red-500">{resetErrors.otp.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    {...registerReset("newPassword")}
                    className={resetErrors.newPassword ? "border-red-500" : ""}
                    disabled={isLoading}
                  />
                  {resetErrors.newPassword && (
                    <p className="text-sm text-red-500">{resetErrors.newPassword.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white transition-all mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Reset Password
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex justify-center border-t border-gray-100 pt-6 pb-6">
            <Link href="/login" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
