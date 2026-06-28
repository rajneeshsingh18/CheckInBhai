"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

interface OTPDisplayProps {
  otp: string;
  label?: string;
  className?: string;
}

export default function OTPDisplay({ otp, label = "Verification OTP", className }: OTPDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(otp);
      setCopied(true);
      toast.success("OTP copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error("Failed to copy OTP");
    }
  };

  const shareOTP = async () => {
    if (typeof navigator !== "undefined" && typeof (navigator as any).share === "function") {
      try {
        await navigator.share({
          title: "Rakshak Gate Pass OTP",
          text: `Your visitor entry verification code is: ${otp}`,
        });
      } catch (err) {
        console.warn("Share failed", err);
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <div className={`flex flex-col items-center bg-orange-50/50 border border-orange-100 rounded-xl p-5 text-center ${className}`}>
      {label && <span className="text-xs font-semibold text-orange-700 tracking-wider uppercase mb-2">{label}</span>}
      
      <div className="flex space-x-2.5 my-2">
        {otp.split("").map((char, index) => (
          <div
            key={index}
            className="w-11 h-14 bg-white border-2 border-orange-200 rounded-lg flex items-center justify-center text-2xl font-black text-orange-600 shadow-sm"
          >
            {char}
          </div>
        ))}
      </div>

      <div className="flex space-x-2 mt-4">
        <Button
          size="sm"
          variant="outline"
          onClick={copyToClipboard}
          className="border-orange-200 text-orange-700 hover:bg-orange-50 text-xs font-semibold"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 mr-1 text-green-600" /> Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 mr-1" /> Copy OTP
            </>
          )}
        </Button>

        {typeof navigator !== "undefined" && typeof (navigator as any).share === "function" && (
          <Button
            size="sm"
            variant="outline"
            onClick={shareOTP}
            className="border-orange-200 text-orange-700 hover:bg-orange-50 text-xs font-semibold"
          >
            <Share2 className="w-3.5 h-3.5 mr-1" /> Share
          </Button>
        )}
      </div>
    </div>
  );
}
