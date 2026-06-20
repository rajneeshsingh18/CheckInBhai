"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, User, Building, Clock, Phone, Shield, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function MorePage() {
  const { user, logout } = useAuth();
  const [pinInput, setPinInput] = useState("");
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);

  const handleSavePin = async () => {
    if (pinInput.length !== 6 || !/^\d+$/.test(pinInput)) {
      toast.error("PIN must be exactly 6 digits.");
      return;
    }

    try {
      setIsSubmittingPin(true);
      await api.post("/auth/setup-pin", { pin: pinInput });
      toast.success("PIN set up successfully!");
      setPinInput("");
      window.location.reload();
    } catch (error) {
      toast.error("Failed to set up PIN. Please try again.");
    } finally {
      setIsSubmittingPin(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white rounded-3xl shadow-xl shadow-neutral-100 overflow-hidden border border-neutral-100 pb-12">
      {/* Header */}
      <div className="bg-[#0b0f1a] text-white p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-2xl border-2 border-white shadow-md">
          {user?.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-bold">{user?.name}</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-300 border border-green-500/30 mt-1">
            Active Shift Duty
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Info list */}
        <div className="space-y-3 bg-neutral-50 p-5 rounded-2xl border border-neutral-100">
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2.5">Guard Station Profile</h3>
          
          <div className="flex items-center justify-between py-2 border-b border-neutral-200/50">
            <span className="text-sm text-neutral-500 flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" /> Guard ID
            </span>
            <span 
              className="text-xs font-mono font-bold text-neutral-900 bg-neutral-100 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-neutral-200 transition-colors"
              onClick={() => {
                if (user?.guard?.id) {
                  navigator.clipboard.writeText(user.guard.id);
                  toast.success("Guard ID copied to clipboard!");
                }
              }}
              title="Click to copy Guard ID"
            >
              {user?.guard?.id || "N/A"}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-neutral-200/50">
            <span className="text-sm text-neutral-500 flex items-center gap-2">
              <Building className="w-4 h-4 text-orange-500" /> Society ID
            </span>
            <span className="text-sm font-bold text-neutral-900">{user?.societyId}</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-neutral-500 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" /> Active Shift
            </span>
            <span className="text-sm font-bold text-neutral-900">08:00 AM - 04:00 PM</span>
          </div>
        </div>

        {/* PIN Management Section */}
        <div className="space-y-3 bg-neutral-50 p-5 rounded-2xl border border-neutral-100">
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2.5">PIN Security</h3>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-neutral-500 flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-500" /> Status
            </span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${user?.guard?.pinCode ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
              {user?.guard?.pinCode ? "PIN Configured" : "PIN Not Configured"}
            </span>
          </div>
          <div className="pt-2 flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder={user?.guard?.pinCode ? "Enter new 6-digit PIN" : "Setup 6-digit PIN"}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              className="flex-1 h-11 border border-neutral-200 rounded-xl px-3 text-sm tracking-widest font-mono text-center focus:outline-none focus:border-orange-500 bg-white"
            />
            <Button
              onClick={handleSavePin}
              disabled={isSubmittingPin || pinInput.length !== 6}
              className="h-11 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl px-4 cursor-pointer"
            >
              {isSubmittingPin ? "Saving..." : "Save PIN"}
            </Button>
          </div>
        </div>

        {/* Emergency Contacts card */}
        <div className="bg-red-50/50 border border-red-100 rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            <h3 className="text-sm font-bold text-red-950">Society Emergency Station</h3>
          </div>
          <p className="text-xs text-red-800 leading-normal">
            Quickly dial emergency services or initiate broadcast overrides from the station terminal.
          </p>
          <div className="space-y-2">
            <a
              href="tel:100"
              className="flex items-center justify-between bg-white border border-red-200/60 p-3 rounded-xl hover:bg-red-100/20 transition-colors"
            >
              <span className="text-sm text-neutral-800 font-bold flex items-center gap-2">
                <Phone className="w-4 h-4 text-red-600" /> Police Control
              </span>
              <span className="text-sm font-extrabold text-red-600 flex items-center gap-1">
                100 <ArrowRight className="w-4 h-4" />
              </span>
            </a>
            <a
              href="tel:101"
              className="flex items-center justify-between bg-white border border-red-200/60 p-3 rounded-xl hover:bg-red-100/20 transition-colors"
            >
              <span className="text-sm text-neutral-800 font-bold flex items-center gap-2">
                <Phone className="w-4 h-4 text-red-600" /> Fire Station
              </span>
              <span className="text-sm font-extrabold text-red-600 flex items-center gap-1">
                101 <ArrowRight className="w-4 h-4" />
              </span>
            </a>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2">
          <Button
            onClick={() => {
              logout();
              toast.success("Successfully logged out.");
            }}
            className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-bold text-base rounded-2xl shadow-lg shadow-red-500/10 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            <span>End Shift & Sign Out</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
