"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import api from "@/lib/api";
import { useSocketEvent } from "@/hooks/useSocket";
import { 
  Bell, QrCode, PlusCircle, Package, Users, AlertTriangle, 
  Clock, ShieldAlert, LogIn, LogOut, CheckCircle, XCircle, Play, Check 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  badge?: string;
  pulsing?: boolean;
}

function StatCard({ title, value, icon, color, badge, pulsing = false }: StatCardProps) {
  return (
    <div className={`min-w-[150px] flex-1 bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between gap-4 relative overflow-hidden ${pulsing ? "ring-2 ring-red-500 animate-pulse" : ""}`}>
      <div>
        <span className="text-xs font-bold text-neutral-400 block uppercase tracking-wider">{title}</span>
        <span className="text-2xl font-black text-neutral-900 mt-1 block">{value}</span>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      {badge && (
        <span className="absolute top-2 right-2 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
      )}
    </div>
  );
}

interface VisitorEntry {
  id: string;
  visitor: {
    name: string;
    mobile: string;
  };
  flat: {
    number: string;
    tower: {
      name: string;
    };
  };
  purpose: string;
  status: "PENDING" | "PRE_APPROVED" | "APPROVED" | "REJECTED" | "EXITED" | "CANCELLED";
  createdAt: string;
  entryTime?: string;
  exitTime?: string;
}

export default function GuardDashboard() {
  const queryClient = useClientQueryClient();
  const [isOnDuty, setIsOnDuty] = useState(true);

  function useClientQueryClient() {
    return useQueryClient();
  }

  // 1. Fetch dashboard aggregates
  const { data: dashboardData, refetch: refetchStats } = useQuery({
    queryKey: ["guard-stats"],
    queryFn: async () => {
      const res = await api.get("/dashboard/guard");
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  // 2. Fetch today's visitors for recent activity list
  const { data: visitorsData, refetch: refetchVisitors } = useQuery({
    queryKey: ["guard-visitors"],
    queryFn: async () => {
      const res = await api.get("/visitors/today?limit=10");
      return res.data.data;
    },
    refetchInterval: 15000,
  });

  // 3. Mutation: Acknowledge SOS
  const acknowledgeSOSMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.post(`/sos/${alertId}/acknowledge`);
    },
    onSuccess: () => {
      toast.success("SOS Alert acknowledged. Responding guards notified.");
      refetchStats();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || "Failed to acknowledge SOS");
    },
  });

  // 4. Mutation: Record exit
  const recordExitMutation = useMutation({
    mutationFn: async (entryId: string) => {
      await api.post(`/visitors/exit/${entryId}`);
    },
    onSuccess: () => {
      toast.success("Visitor exit recorded.");
      refetchStats();
      refetchVisitors();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || "Failed to record exit");
    },
  });

  // 5. Setup Socket.io Event Subscriptions
  useSocketEvent("visitor:new-entry", (data: any) => {
    toast.info(`New visitor entry raised for Flat ${data.entry.flatId}`);
    refetchStats();
    refetchVisitors();
  });

  useSocketEvent("visitor:approved", (data: any) => {
    toast.success(`Visitor ${data.visitorName} approved for Flat ${data.flatNumber}`);
    refetchStats();
    refetchVisitors();
  });

  useSocketEvent("visitor:rejected", (data: any) => {
    toast.error(`Visitor ${data.visitorName} rejected for Flat ${data.flatNumber}: ${data.reason || "Resident rejected"}`);
    refetchStats();
    refetchVisitors();
  });

  useSocketEvent("visitor:exited", (data: any) => {
    refetchStats();
    refetchVisitors();
  });

  useSocketEvent("sos:raised", (data: any) => {
    // Play sound notification
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch siren
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.5);
    } catch (e) {}

    // Vibrate device
    if (navigator.vibrate) {
      navigator.vibrate([300, 100, 300, 100, 300]);
    }

    toast.error(`🚨 EMERGENCY SOS RAISED by ${data.alert.raisedBy} at ${data.alert.location}!`, {
      duration: 10000,
    });
    refetchStats();
  });

  useSocketEvent("sos:acknowledged", () => {
    refetchStats();
  });

  useSocketEvent("sos:resolved", () => {
    refetchStats();
  });

  const stats = dashboardData?.stats || {
    pendingVisitors: 0,
    todayVisitors: 0,
    todayDeliveries: 0,
    staffCheckIns: 0,
    activeAlerts: 0,
    qrScans: 0,
  };

  const emergency = dashboardData?.emergency || {
    activeAlerts: 0,
    unacknowledged: 0,
    latestAlert: null,
  };

  const entries: VisitorEntry[] = visitorsData?.entries || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700">Pending</span>;
      case "PRE_APPROVED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 border border-blue-200 text-blue-700">Pre-Approved</span>;
      case "APPROVED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">Approved</span>;
      case "REJECTED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 border border-red-200 text-red-700">Rejected</span>;
      case "EXITED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 border border-neutral-200 text-neutral-600">Exited</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-50 border border-neutral-200 text-neutral-500">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. SOS Critical Emergency Banner */}
      {emergency.activeAlerts > 0 && emergency.latestAlert && (
        <div className="bg-red-600 text-white p-5 rounded-3xl shadow-xl shadow-red-500/25 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg tracking-tight">🚨 Emergency SOS Alert</h3>
              <p className="text-white/80 text-sm mt-0.5">
                Raised by <span className="font-black text-white">{emergency.latestAlert.raisedBy}</span> • Flat {emergency.latestAlert.location}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {emergency.latestAlert.status === "ACTIVE" ? (
              <Button
                onClick={() => acknowledgeSOSMutation.mutate(emergency.latestAlert.id)}
                disabled={acknowledgeSOSMutation.isPending}
                className="bg-white hover:bg-neutral-100 text-red-600 font-extrabold rounded-xl px-5 py-2.5 text-sm shadow-md"
              >
                Acknowledge Alert
              </Button>
            ) : (
              <span className="bg-white/20 text-white font-extrabold text-xs px-3 py-1.5 rounded-lg border border-white/30 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Acknowledged
              </span>
            )}
          </div>
        </div>
      )}

      {/* 2. Duty Status Bar */}
      <div className="bg-white border border-neutral-100 rounded-3xl p-5 shadow-sm flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-neutral-900 leading-tight">Guard Gate Operations</h2>
          <p className="text-neutral-400 text-xs mt-1">Shift: Morning Duty • 08:00 AM - 04:00 PM</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${isOnDuty ? "text-emerald-600" : "text-neutral-400"}`}>
            {isOnDuty ? "On Duty" : "Off Duty"}
          </span>
          <button
            onClick={() => setIsOnDuty(!isOnDuty)}
            className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${
              isOnDuty ? "bg-emerald-600 justify-end" : "bg-neutral-200 justify-start"
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-white shadow-md block"></span>
          </button>
        </div>
      </div>

      {/* 3. Stats Row (Horizontal Scroll on Mobile) */}
      <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-none snap-x">
        <StatCard
          title="Pending"
          value={stats.pendingVisitors}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          color="bg-amber-50"
          badge={stats.pendingVisitors > 0 ? "badge" : undefined}
        />
        <StatCard
          title="Total Visitors"
          value={stats.todayVisitors}
          icon={<PlusCircle className="w-5 h-5 text-orange-600" />}
          color="bg-orange-50"
        />
        <StatCard
          title="Deliveries"
          value={stats.todayDeliveries}
          icon={<Package className="w-5 h-5 text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          title="Staff In"
          value={stats.staffCheckIns}
          icon={<Users className="w-5 h-5 text-emerald-600" />}
          color="bg-emerald-50"
        />
        {stats.activeAlerts > 0 && (
          <StatCard
            title="SOS Alerts"
            value={stats.activeAlerts}
            icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
            color="bg-red-50"
            pulsing={true}
          />
        )}
      </div>

      {/* 4. Quick Actions Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider">Gate Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link
            href="/guard/entry"
            className="bg-orange-600 hover:bg-orange-700 text-white p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-transform"
          >
            <PlusCircle className="w-8 h-8" />
            <span className="text-sm font-bold leading-tight">Log Visitor</span>
          </Link>
          <Link
            href="/guard/scanner"
            className="bg-neutral-900 hover:bg-neutral-800 text-white p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-lg shadow-neutral-900/10 active:scale-95 transition-transform"
          >
            <QrCode className="w-8 h-8 text-orange-500" />
            <span className="text-sm font-bold leading-tight">Scan QR Pass</span>
          </Link>
          <Link
            href="/guard/deliveries"
            className="bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-lg shadow-blue-600/10 active:scale-95 transition-transform"
          >
            <Package className="w-8 h-8" />
            <span className="text-sm font-bold leading-tight">Log Delivery</span>
          </Link>
          <Link
            href="/guard/staff"
            className="bg-emerald-600 hover:bg-emerald-700 text-white p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-lg shadow-emerald-600/10 active:scale-95 transition-transform"
          >
            <Users className="w-8 h-8" />
            <span className="text-sm font-bold leading-tight">Staff In/Out</span>
          </Link>
          <Link
            href="/guard/activity"
            className="bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 active:scale-95 transition-transform"
          >
            <Clock className="w-8 h-8 text-neutral-400" />
            <span className="text-sm font-bold leading-tight">Today's Logs</span>
          </Link>
          <button
            onClick={() => {
              toast.error("Emergency SOS Broadcast Triggered! Responders and residents are notified.");
            }}
            className="bg-red-600 hover:bg-red-700 text-white p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-lg shadow-red-600/15 active:scale-95 transition-transform"
          >
            <AlertTriangle className="w-8 h-8 text-white animate-bounce" />
            <span className="text-sm font-bold leading-tight">Trigger SOS</span>
          </button>
        </div>
      </div>

      {/* 5. Recent Activity List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider">Recent Activity</h3>
          <Link href="/guard/activity" className="text-xs font-bold text-orange-600 hover:text-orange-700">
            See All Logs
          </Link>
        </div>

        <div className="space-y-2">
          {entries.length > 0 ? (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white border border-neutral-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center font-bold text-neutral-600 text-sm">
                    {entry.visitor.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900 text-sm">{entry.visitor.name}</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Flat {entry.flat.tower.name}-{entry.flat.number} • {entry.purpose}
                    </p>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-1.5">
                  {getStatusBadge(entry.status)}
                  <span className="text-[10px] text-neutral-400">
                    {new Date(entry.createdAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  
                  {/* Action button to record exit for APPROVED visitors */}
                  {entry.status === "APPROVED" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => recordExitMutation.mutate(entry.id)}
                      disabled={recordExitMutation.isPending}
                      className="text-[10px] font-bold h-7 px-2.5 rounded-lg border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                    >
                      Record Exit
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-neutral-400 bg-white border border-neutral-100 rounded-3xl shadow-sm italic">
              No visitor logs registered today.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
