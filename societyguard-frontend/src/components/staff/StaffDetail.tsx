"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { ArrowLeft, Calendar as CalendarIcon, Clock, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Ban, Banknote, MessageSquare } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format, isSameMonth, parseISO, startOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";

interface StaffDetailProps {
  staffId: string;
}

const TYPE_EMOJIS: Record<string, string> = {
  MAID: "🧹",
  DRIVER: "🚗",
  COOK: "🍳",
  NANNY: "👶",
  OTHER: "📋",
};

export default function StaffDetail({ staffId }: StaffDetailProps) {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState("");

  // Fetch basic staff details
  const { data: staffData, isLoading: isStaffLoading } = useQuery({
    queryKey: ["staff", staffId],
    queryFn: async () => {
      const res = await api.get(`/staff/${staffId}`);
      return res.data.data;
    },
  });

  // Fetch attendance report for the selected month
  const { data: reportData, isLoading: isReportLoading } = useQuery({
    queryKey: ["staff-report", staffId, currentMonth.getMonth() + 1, currentMonth.getFullYear()],
    queryFn: async () => {
      const res = await api.get(`/attendance/report/${staffId}`, {
        params: {
          month: currentMonth.getMonth() + 1,
          year: currentMonth.getFullYear()
        }
      });
      return res.data.data;
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const res = await api.put(`/staff/${staffId}`, { notesForGuard: note });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Note for guard updated!");
      queryClient.invalidateQueries({ queryKey: ["staff", staffId] });
      setIsEditingNote(false);
    },
    onError: () => {
      toast.error("Failed to update note");
    }
  });

  if (isStaffLoading) {
    return <div className="p-8 animate-pulse bg-neutral-100 h-96 rounded-3xl"></div>;
  }

  const staff = staffData;
  const report = reportData;
  const attendanceRecords = report?.dailyBreakdown || [];

  // Map dates to modifiers for React Day Picker
  const presentDates = attendanceRecords
    .filter((a: any) => a.checkInTime && a.status !== "LATE")
    .map((a: any) => parseISO(a.checkInTime));

  const lateDates = attendanceRecords
    .filter((a: any) => a.status === "LATE")
    .map((a: any) => parseISO(a.checkInTime));

  const absentDates = attendanceRecords
    .filter((a: any) => a.status === "ABSENT")
    .map((a: any) => parseISO(a.createdAt));

  const modifiers = {
    present: presentDates,
    late: lateDates,
    absent: absentDates,
  };

  const modifiersStyles = {
    present: { backgroundColor: "#d1fae5", color: "#065f46", fontWeight: "bold" },
    late: { backgroundColor: "#fef3c7", color: "#92400e", fontWeight: "bold" },
    absent: { backgroundColor: "#fee2e2", color: "#991b1b", fontWeight: "bold" },
  };

  // Find record for a specific date
  const getRecordForDate = (date: Date) => {
    return attendanceRecords.find((a: any) => {
      const recordDate = parseISO(a.checkInTime || a.createdAt);
      return recordDate.getDate() === date.getDate() && recordDate.getMonth() === date.getMonth();
    });
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/resident/staff">
          <Button variant="outline" size="icon" className="rounded-xl hover:bg-neutral-100">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            {TYPE_EMOJIS[staff?.type || "OTHER"]} {staff?.name}
          </h1>
          <p className="text-neutral-500 text-sm font-medium">{staff?.type} • Registered on {format(parseISO(staff?.createdAt || new Date().toISOString()), "MMM d, yyyy")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Calendar */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-neutral-200/50 border border-neutral-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-orange-600" /> Attendance Calendar
              </h2>
              <div className="flex gap-2 text-xs font-bold">
                <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Present</span>
                <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-1 rounded-md"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Late</span>
                <span className="flex items-center gap-1 text-red-700 bg-red-50 px-2 py-1 rounded-md"><div className="w-2 h-2 rounded-full bg-red-500"></div> Absent</span>
              </div>
            </div>

            <div className="flex justify-center border border-neutral-100 rounded-2xl p-4 bg-neutral-50/50">
              <DayPicker
                mode="single"
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                modifiers={modifiers}
                modifiersStyles={modifiersStyles}
                className="font-sans"
                classNames={{
                  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-4",
                  nav: "space-x-1 flex items-center bg-white border border-neutral-200 rounded-xl p-1",
                  month_grid: "w-full border-collapse space-y-1",
                  weekdays: "flex w-full mb-2",
                  weekday: "text-neutral-500 rounded-md w-12 font-bold text-[0.8rem] uppercase tracking-wider",
                  week: "flex w-full mt-2",
                  day: "text-center text-sm p-0 relative focus-within:relative focus-within:z-20 h-12 w-12 flex items-center justify-center",
                  day_button: "h-10 w-10 p-0 font-medium rounded-xl hover:bg-neutral-200 transition-all focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer",
                  selected: "bg-orange-600 text-white hover:bg-orange-600 hover:text-white font-bold shadow-lg shadow-orange-500/30",
                  today: "border-2 border-orange-500 text-orange-700 font-bold",
                  outside: "text-neutral-300 opacity-50",
                  disabled: "text-neutral-300 opacity-50",
                  hidden: "invisible",
                } as any}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Stats & Selected Day Details */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-neutral-200/50 border border-neutral-100">
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Monthly Summary</h2>

            {isReportLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-16 bg-neutral-100 rounded-2xl"></div>
                <div className="h-16 bg-neutral-100 rounded-2xl"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Present</p>
                  <p className="text-3xl font-black text-emerald-900 mt-1">{report?.summary?.presentDays || 0}</p>
                </div>
                <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Absent</p>
                  <p className="text-3xl font-black text-red-900 mt-1">{report?.summary?.absentDays || 0}</p>
                </div>
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Late</p>
                  <p className="text-3xl font-black text-amber-900 mt-1">{report?.summary?.lateDays || 0}</p>
                </div>
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Total Hrs</p>
                  <p className="text-3xl font-black text-blue-900 mt-1">{report?.summary?.totalHours || 0}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-neutral-900 text-white rounded-3xl p-6 shadow-xl shadow-neutral-900/20">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" /> Shift Schedule
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/5">
                <span className="text-sm font-medium text-neutral-300">Working Days</span>
                <span className="text-sm font-bold text-white">
                  {staff?.schedule?.days?.join(", ") || "Mon-Sat"}
                </span>
              </div>
              <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/5">
                <span className="text-sm font-medium text-neutral-300">Check-In</span>
                <span className="text-sm font-bold text-white">
                  {staff?.schedule?.checkInWindow?.start} - {staff?.schedule?.checkInWindow?.end}
                </span>
              </div>
              <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/5">
                <span className="text-sm font-medium text-neutral-300">Check-Out</span>
                <span className="text-sm font-bold text-white">
                  {staff?.schedule?.checkOutWindow?.start} - {staff?.schedule?.checkOutWindow?.end}
                </span>
              </div>
            </div>
          </div>

          {/* Salary Widget */}
          {(report?.monthlySalary || report?.hourlyRate) && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-3xl p-6 shadow-xl shadow-green-200/50 border border-green-200">
              <h2 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-green-600" /> Salary Estimate
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-green-200 pb-3">
                  <div>
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wider">Estimated Pay</p>
                    <p className="text-3xl font-black text-green-900 mt-1">₹{report?.summary?.estimatedSalary?.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-green-700 bg-green-200/50 px-2 py-1 rounded-md">
                      {report?.summary?.salaryBasis} Basis
                    </p>
                  </div>
                </div>
                <div className="text-xs text-green-800 font-medium">
                  {report?.summary?.salaryBasis === 'Monthly' ? (
                    <p>Based on ₹{report.monthlySalary?.toLocaleString()}/mo. Deductions applied for late arrivals and absences.</p>
                  ) : (
                    <p>Based on ₹{report.hourlyRate}/hr for {report?.summary?.totalHours} hours worked.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Guard Note Widget */}
          <div className="bg-amber-50 rounded-3xl p-6 shadow-xl shadow-amber-200/50 border border-amber-200">
            <h2 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-600" /> Note for Gate Guard
            </h2>
            {isEditingNote ? (
              <div className="space-y-3">
                <textarea
                  className="w-full p-3 rounded-xl border border-amber-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  rows={3}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="e.g. Please give the spare keys to the maid today."
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingNote(false)} className="text-amber-700 hover:bg-amber-100">Cancel</Button>
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => updateNoteMutation.mutate(noteInput)}
                    disabled={updateNoteMutation.isPending}
                  >
                    Save Note
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {staff?.notesForGuard ? (
                  <p className="text-sm font-medium text-amber-800 bg-amber-100/50 p-4 rounded-xl border border-amber-200/50 italic">
                    "{staff.notesForGuard}"
                  </p>
                ) : (
                  <p className="text-sm text-amber-700/60 italic p-4 text-center border border-dashed border-amber-200 rounded-xl">
                    No note set for the guard.
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={() => {
                    setNoteInput(staff?.notesForGuard || "");
                    setIsEditingNote(true);
                  }}
                >
                  {staff?.notesForGuard ? "Update Note" : "Leave Note for Guard"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
