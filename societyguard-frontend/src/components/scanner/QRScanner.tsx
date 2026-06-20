"use client";

import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QrCode, Camera, AlertCircle, CheckCircle2, XCircle, ArrowRight, RotateCcw, Shield } from "lucide-react";

interface ScanHistoryItem {
  id: string;
  visitorName: string;
  flatNumber: string;
  towerName: string;
  purpose: string;
  time: string;
  status: "success" | "expired" | "invalid";
  message?: string;
}

export default function QRScanner() {
  const [qrTokenInput, setQrTokenInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    visitorName?: string;
    flatNumber?: string;
    towerName?: string;
    purpose?: string;
    message: string;
  } | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerId = "qr-reader-container";

  // Load scan history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rakshak_scan_history");
      if (saved) setScanHistory(JSON.parse(saved));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const saveToHistory = (item: Omit<ScanHistoryItem, "id" | "time">) => {
    const newItem: ScanHistoryItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
    const updated = [newItem, ...scanHistory.slice(0, 4)];
    setScanHistory(updated);
    localStorage.setItem("rakshak_scan_history", JSON.stringify(updated));
  };

  const startScanner = async () => {
    setScanResult(null);
    setIsScanning(true);
    try {
      // Small timeout to let DOM mount the element if toggled
      setTimeout(async () => {
        try {
          const html5QrCode = new Html5Qrcode(readerId);
          html5QrCodeRef.current = html5QrCode;

          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (qrCodeMessage) => {
              // On success
              stopScanner();
              // Validate the scanned token
              validateToken(qrCodeMessage);
            },
            (errorMessage) => {
              // Silent failure (polling matches)
            }
          );
        } catch (err: any) {
          console.error("Scanner Start Error:", err);
          toast.error("Failed to start camera. Make sure camera permission is granted.");
          setIsScanning(false);
        }
      }, 100);
    } catch (e) {
      console.error(e);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error("Scanner Stop Error:", err);
      }
    }
    setIsScanning(false);
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const validateToken = async (token: string) => {
    if (!token.trim()) return;
    try {
      setIsValidating(true);
      setScanResult(null);

      // Play short audio beep or device vibration if API available
      if (typeof window !== "undefined" && navigator.vibrate) {
        navigator.vibrate(100);
      }

      const response = await api.post("/guest-passes/validate", { qrToken: token });
      const pass = response.data.data;

      const result = {
        success: true,
        visitorName: pass.visitorName,
        flatNumber: pass.flatNumber,
        towerName: pass.towerName,
        purpose: pass.purpose,
        message: "Valid Pass. Access Granted!",
      };
      setScanResult(result);
      
      saveToHistory({
        visitorName: pass.visitorName,
        flatNumber: pass.flatNumber,
        towerName: pass.towerName,
        purpose: pass.purpose,
        status: "success",
        message: "Valid Pass",
      });

      toast.success(`Access Granted: ${pass.visitorName} for ${pass.towerName}-${pass.flatNumber}`);
      setQrTokenInput("");
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.error?.message || "Invalid or expired guest pass";
      
      // Attempt to extract details from token if JWT to show history context
      let visName = "Unknown Guest";
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.visitorName) visName = payload.visitorName;
      } catch(e) {}

      const result = {
        success: false,
        message: errorMsg,
      };
      setScanResult(result);

      saveToHistory({
        visitorName: visName,
        flatNumber: "N/A",
        towerName: "N/A",
        purpose: "N/A",
        status: "invalid",
        message: errorMsg,
      });

      toast.error(errorMsg);
    } finally {
      setIsValidating(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateToken(qrTokenInput);
  };

  return (
    <div className="max-w-lg mx-auto bg-white rounded-3xl shadow-xl shadow-neutral-100 overflow-hidden border border-neutral-100 pb-12">
      {/* Header */}
      <div className="bg-[#0b0f1a] text-white p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <QrCode className="w-6 h-6 text-orange-500" /> Pass Scanner
          </h2>
          <p className="text-neutral-400 text-sm mt-1">Scan visitor QR or validate code</p>
        </div>
        <Shield className="w-8 h-8 text-orange-500/80" />
      </div>

      <div className="p-6 space-y-6">
        {/* Camera Viewport Wrapper */}
        <div className="bg-neutral-900 rounded-2xl overflow-hidden relative min-h-[280px] flex flex-col items-center justify-center border border-neutral-800 shadow-inner">
          {isScanning ? (
            <div className="w-full h-full flex flex-col items-center relative">
              <div id={readerId} className="w-full bg-black"></div>
              <div className="absolute top-4 left-4 right-4 bg-black/60 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full text-center z-10 font-medium">
                Point camera at the visitor's guest pass QR
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={stopScanner}
                className="absolute bottom-4 z-20 rounded-full px-6 font-bold shadow-lg"
              >
                Cancel Scanning
              </Button>
            </div>
          ) : (
            <div className="text-center p-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700 text-neutral-400 shadow-md">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <p className="text-white font-bold text-base">Camera Scanner Off</p>
                <p className="text-neutral-500 text-xs mt-1">Use the camera to scan the visitor's QR pass</p>
              </div>
              <Button
                type="button"
                onClick={startScanner}
                className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl px-6 py-2.5 font-bold shadow-lg shadow-orange-500/20"
              >
                Activate Camera Scanner
              </Button>
            </div>
          )}
        </div>

        {/* Validation Result Modal-like Box */}
        {scanResult && (
          <div
            className={`p-5 rounded-2xl border flex gap-4 animate-in fade-in slide-in-from-bottom-2 ${
              scanResult.success
                ? "bg-emerald-50 border-emerald-100 text-emerald-900"
                : "bg-red-50 border-red-100 text-red-900"
            }`}
          >
            <div className="mt-0.5">
              {scanResult.success ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              ) : (
                <XCircle className="w-7 h-7 text-red-600" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-extrabold text-lg tracking-tight">{scanResult.message}</p>
              {scanResult.success && (
                <div className="text-sm space-y-0.5 mt-2 bg-white/60 p-3 rounded-xl border border-emerald-200/50">
                  <p className="font-medium text-emerald-800">
                    Guest Name: <span className="font-bold text-neutral-900">{scanResult.visitorName}</span>
                  </p>
                  <p className="font-medium text-emerald-800">
                    Flat: <span className="font-bold text-neutral-900">{scanResult.towerName} - Flat {scanResult.flatNumber}</span>
                  </p>
                  <p className="font-medium text-emerald-800">
                    Purpose: <span className="font-bold text-neutral-900">{scanResult.purpose}</span>
                  </p>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => setScanResult(null)}
                className={`text-xs font-bold mt-2 h-8 px-3 rounded-lg flex items-center gap-1 ${
                  scanResult.success
                    ? "hover:bg-emerald-100 text-emerald-800"
                    : "hover:bg-red-100 text-red-800"
                }`}
              >
                Clear Result
              </Button>
            </div>
          </div>
        )}

        {/* Manual Token Entry Fallback */}
        <form onSubmit={handleManualSubmit} className="space-y-3 bg-neutral-50 p-5 rounded-2xl border border-neutral-100">
          <Label htmlFor="token" className="text-sm font-bold text-neutral-800 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-orange-500" /> Manual Token Entry
          </Label>
          <div className="flex gap-2">
            <Input
              id="token"
              placeholder="Paste or type guest token..."
              value={qrTokenInput}
              onChange={(e) => setQrTokenInput(e.target.value)}
              className="h-12 rounded-xl bg-white border-neutral-200 text-base"
              disabled={isValidating}
            />
            <Button
              type="submit"
              disabled={isValidating || !qrTokenInput.trim()}
              className="bg-neutral-900 hover:bg-neutral-800 text-white h-12 rounded-xl px-5 font-bold shadow flex items-center justify-center gap-1.5"
            >
              {isValidating ? (
                <RotateCcw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Verify</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Scan History list */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Recent Scans Today</h3>
          {scanHistory.length > 0 ? (
            <div className="space-y-2">
              {scanHistory.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-neutral-100 rounded-xl p-3.5 flex items-center justify-between shadow-sm"
                >
                  <div>
                    <p className="text-sm font-bold text-neutral-900">{item.visitorName}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Flat {item.flatNumber} • {item.purpose}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        item.status === "success"
                          ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                          : "bg-red-50 border-red-100 text-red-700"
                      }`}
                    >
                      {item.message || (item.status === "success" ? "Access Allowed" : "Rejected")}
                    </span>
                    <p className="text-[10px] text-neutral-400 mt-1">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-400 italic text-center p-4 bg-neutral-50/50 rounded-xl border border-dashed border-neutral-100">
              No scans logged in this session yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
