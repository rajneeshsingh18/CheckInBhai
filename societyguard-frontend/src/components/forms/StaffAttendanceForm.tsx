"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, Search, CheckCircle, LogIn, LogOut, Clock, RefreshCw, AlertCircle, Calendar } from "lucide-react";

interface StaffInfo {
  id: string;
  name: string;
  type: "MAID" | "DRIVER" | "COOK" | "NANNY" | "OTHER";
  flatNumber: string;
  towerName: string;
  todayAttendance: {
    id: string;
    checkInTime: string;
    checkOutTime: string | null;
    status: string;
  } | null;
}

interface AttendanceData {
  checkedIn: StaffInfo[];
  checkedOut: StaffInfo[];
  notArrived: StaffInfo[];
  absent: StaffInfo[];
}

const TYPE_EMOJIS = {
  MAID: "🧹",
  DRIVER: "🚗",
  COOK: "🍳",
  NANNY: "👶",
  OTHER: "📋",
};

export default function StaffAttendanceForm() {
  const [activeTab, setActiveTab] = useState<"check-in" | "check-out" | "summary">("check-in");
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  // Fetch today's attendance directory
  const { data: attendance, isLoading, error, refetch } = useQuery<AttendanceData>({
    queryKey: ["today-attendance"],
    queryFn: async () => {
      const res = await api.get("/attendance/today");
      return res.data.data;
    },
  });

  // Check-In Mutation
  const checkInMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const res = await api.post(`/attendance/check-in/${staffId}`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Check-in recorded for ${data.data.staff.name}`);
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["guard-stats"] });
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err.response?.data?.error?.message || "Failed to check in staff");
    },
  });

  // Check-Out Mutation
  const checkOutMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const res = await api.post(`/attendance/check-out/${staffId}`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Check-out recorded for ${data.data.staff.name}`);
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["guard-stats"] });
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err.response?.data?.error?.message || "Failed to check out staff");
    },
  });

  const filterStaff = (list: StaffInfo[] = []) => {
    return list.filter((staff) => {
      const searchStr = `${staff.name} ${staff.towerName} ${staff.flatNumber} ${staff.type}`.toLowerCase();
      return searchStr.includes(searchQuery.toLowerCase());
    });
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-orange-600 animate-spin mb-3" />
        <p className="text-neutral-500 font-medium text-sm">Loading staff directory...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center max-w-md mx-auto bg-red-50 border border-red-100 rounded-3xl mt-4">
        <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
        <h3 className="font-bold text-red-950">Failed to load staff list</h3>
        <p className="text-red-700 text-xs mt-1">Please check your network connection and try again.</p>
        <Button onClick={() => refetch()} className="bg-red-600 hover:bg-red-700 text-white mt-4 rounded-xl px-5">
          Retry Loading
        </Button>
      </div>
    );
  }

  const notArrivedList = filterStaff(attendance?.notArrived);
  const checkedInList = filterStaff(attendance?.checkedIn);
  const checkedOutList = filterStaff(attendance?.checkedOut);
  const absentList = filterStaff(attendance?.absent);

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-neutral-100 max-w-lg mx-auto overflow-hidden border border-neutral-100 pb-12">
      {/* Header */}
      <div className="bg-[#0b0f1a] text-white p-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-orange-500" /> Staff Attendance
        </h2>
        <p className="text-neutral-400 text-sm mt-1">Manage society staff entry and exits</p>
      </div>

      {/* Segmented Tabs Control */}
      <div className="p-4 bg-neutral-50 border-b border-neutral-100 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab("check-in");
            setSearchQuery("");
          }}
          className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
            activeTab === "check-in"
              ? "bg-[#0b0f1a] text-white shadow-md shadow-black/10 scale-105"
              : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <LogIn className="w-4 h-4" /> Check-In ({attendance?.notArrived.length || 0})
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("check-out");
            setSearchQuery("");
          }}
          className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
            activeTab === "check-out"
              ? "bg-[#0b0f1a] text-white shadow-md shadow-black/10 scale-105"
              : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <LogOut className="w-4 h-4" /> Check-Out ({attendance?.checkedIn.length || 0})
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("summary");
            setSearchQuery("");
          }}
          className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
            activeTab === "summary"
              ? "bg-[#0b0f1a] text-white shadow-md shadow-black/10 scale-105"
              : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <Calendar className="w-4 h-4" /> Log Summary
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Search */}
        {activeTab !== "summary" && (
          <div className="relative">
            <Search className="w-5 h-5 text-neutral-400 absolute left-4 top-3.5" />
            <Input
              placeholder={activeTab === "check-in" ? "Search staff to check in..." : "Search checked-in staff..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-2xl bg-neutral-50 border-neutral-200 text-base focus:ring-2 focus:ring-orange-100"
            />
          </div>
        )}

        {/* Tab Content: Check-In */}
        {activeTab === "check-in" && (
          <div className="space-y-3">
            {notArrivedList.length > 0 ? (
              notArrivedList.map((staff) => (
                <div
                  key={staff.id}
                  className="bg-white border border-neutral-100 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:border-neutral-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-xl shadow-inner">
                      {TYPE_EMOJIS[staff.type] || "📋"}
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900 text-base">{staff.name}</h4>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {staff.type} • Flat {staff.towerName}-{staff.flatNumber}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => checkInMutation.mutate(staff.id)}
                    disabled={checkInMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-4 font-bold shadow-md shadow-emerald-500/10 active:scale-95 transition-transform flex items-center gap-1 text-xs"
                  >
                    <LogIn className="w-3.5 h-3.5" /> IN
                  </Button>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-neutral-400 bg-neutral-50/50 rounded-2xl border border-dashed border-neutral-100">
                {searchQuery ? "No matching staff found" : "All registered staff have arrived!"}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Check-Out */}
        {activeTab === "check-out" && (
          <div className="space-y-3">
            {checkedInList.length > 0 ? (
              checkedInList.map((staff) => (
                <div
                  key={staff.id}
                  className="bg-white border border-neutral-100 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:border-neutral-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-xl shadow-inner">
                      {TYPE_EMOJIS[staff.type] || "📋"}
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900 text-base">{staff.name}</h4>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {staff.type} • Flat {staff.towerName}-{staff.flatNumber}
                      </p>
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-600">
                        <Clock className="w-3 h-3" /> Checked In: {formatTime(staff.todayAttendance?.checkInTime)}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => checkOutMutation.mutate(staff.id)}
                    disabled={checkOutMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-10 px-4 font-bold shadow-md shadow-amber-500/10 active:scale-95 transition-transform flex items-center gap-1 text-xs"
                  >
                    <LogOut className="w-3.5 h-3.5" /> OUT
                  </Button>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-neutral-400 bg-neutral-50/50 rounded-2xl border border-dashed border-neutral-100">
                {searchQuery ? "No matching staff found" : "No staff members currently checked in."}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Log Summary */}
        {activeTab === "summary" && (
          <div className="space-y-6">
            {/* Checked-Out Staff */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Completed Shifts ({checkedOutList.length})
              </h3>
              {checkedOutList.length > 0 ? (
                <div className="space-y-2">
                  {checkedOutList.map((staff) => (
                    <div
                      key={staff.id}
                      className="bg-neutral-50 border border-neutral-100 rounded-xl p-3.5 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-bold text-neutral-800">{staff.name}</p>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {staff.type} • Flat {staff.towerName}-{staff.flatNumber}
                        </p>
                      </div>
                      <div className="text-right text-[11px] text-neutral-500 space-y-0.5">
                        <p>IN: {formatTime(staff.todayAttendance?.checkInTime)}</p>
                        <p>OUT: {formatTime(staff.todayAttendance?.checkOutTime || undefined)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-400 italic p-3 bg-neutral-50/50 rounded-xl border border-dashed border-neutral-100 text-center">
                  No completed shifts logged today.
                </p>
              )}
            </div>

            {/* Absent Staff */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-red-500" /> Marked Absent ({absentList.length})
              </h3>
              {absentList.length > 0 ? (
                <div className="space-y-2">
                  {absentList.map((staff) => (
                    <div
                      key={staff.id}
                      className="bg-red-50/30 border border-red-100/50 rounded-xl p-3.5 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-bold text-red-900">{staff.name}</p>
                        <p className="text-[11px] text-red-700 mt-0.5">
                          {staff.type} • Flat {staff.towerName}-{staff.flatNumber}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        ABSENT
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-400 italic p-3 bg-neutral-50/50 rounded-xl border border-dashed border-neutral-100 text-center">
                  No staff members marked absent today.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
