"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
  className?: string;
}

export default function QRCodeDisplay({ value, size = 180, label, className }: QRCodeDisplayProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  const downloadQRCode = () => {
    try {
      const canvas = qrRef.current?.querySelector("canvas");
      if (!canvas) {
        toast.error("QR Code canvas not found");
        return;
      }
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = `rakshak-guest-pass-${value.slice(0, 8)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("QR Code downloaded!");
    } catch (e) {
      toast.error("Download failed");
    }
  };

  const shareQRCode = async () => {
    try {
      const canvas = qrRef.current?.querySelector("canvas");
      if (!canvas) return;
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], "pass.png", { type: "image/png" });
        if (typeof navigator !== "undefined" && typeof (navigator as any).share === "function" && typeof (navigator as any).canShare === "function" && (navigator as any).canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: "Rakshak Gate Pass QR",
              text: "Scan this QR code at the gate for entry validation.",
            });
          } catch (err) {
            console.warn("Share failed", err);
          }
        } else {
          downloadQRCode();
        }
      });
    } catch (err) {
      toast.error("Could not share QR code");
    }
  };

  return (
    <div className={`flex flex-col items-center p-6 bg-white border border-gray-200 rounded-2xl shadow-sm ${className}`}>
      {label && <h5 className="text-sm font-bold text-gray-900 mb-3.5 tracking-tight">{label}</h5>}

      <div ref={qrRef} className="p-4 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 flex items-center justify-center">
        <QRCodeCanvas
          value={value}
          size={size}
          level="H"
          includeMargin={true}
          className="rounded"
        />
      </div>

      <div className="flex space-x-2.5 mt-4 w-full">
        <Button
          size="sm"
          variant="outline"
          onClick={downloadQRCode}
          className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" /> Download
        </Button>
        {typeof navigator !== "undefined" && typeof (navigator as any).share === "function" && (
          <Button
            size="sm"
            variant="outline"
            onClick={shareQRCode}
            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold"
          >
            <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
          </Button>
        )}
      </div>
    </div>
  );
}
