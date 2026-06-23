"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Users, UserPlus, Phone, Calendar as CalendarIcon, Clock, XCircle, CalendarDays } from "lucide-react";
import Link from "next/link";

const staffSchema = z.object({
  name: z.string().min(2, "Name is required"),
  type: z.enum(['MAID', 'DRIVER', 'COOK', 'NANNY', 'OTHER']),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid mobile number").optional().or(z.literal('')),
});

type StaffFormValues = z.infer<typeof staffSchema>;

export default function ResidentStaff() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("directory");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  const { data: staffList, isLoading: staffLoading } = useQuery({
    queryKey: ['residentStaff'],
    queryFn: async () => {
      const res = await api.get('/staff');
      return res.data.data;
    }
  });

  const { data: attendanceReport, isLoading: reportLoading } = useQuery({
    queryKey: ['attendanceReport', reportMonth, reportYear],
    queryFn: async () => {
      const res = await api.get('/attendance/report', { 
        params: { month: reportMonth, year: reportYear } 
      });
      return res.data.data;
    },
    enabled: activeTab === "report"
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { type: 'MAID' }
  });

  const addStaffMutation = useMutation({
    mutationFn: async (data: StaffFormValues) => {
      const payload = {
        name: data.name,
        type: data.type,
        mobile: data.mobile || undefined,
        schedule: {
          days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
          checkInWindow: { start: "06:00", end: "12:00" },
          checkOutWindow: { start: "14:00", end: "20:00" }
        }
      };
      const res = await api.post('/staff', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Staff member registered successfully");
      queryClient.invalidateQueries({ queryKey: ['residentStaff'] });
      setIsAddModalOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to register staff");
    }
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/staff/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Staff deactivated successfully");
      queryClient.invalidateQueries({ queryKey: ['residentStaff'] });
    }
  });

  const onSubmit = (data: StaffFormValues) => {
    addStaffMutation.mutate(data);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-green-600" />
            My Staff
          </h1>
          <p className="text-gray-500">Manage your daily help and view attendance</p>
        </div>
        <Button 
          className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
          onClick={() => setIsAddModalOpen(true)}
        >
          <UserPlus className="w-4 h-4 mr-2" /> Add Staff
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full sm:w-64 h-12 mb-6">
          <TabsTrigger value="directory" className="h-10">Directory</TabsTrigger>
          <TabsTrigger value="report" className="h-10">Attendance Report</TabsTrigger>
        </TabsList>
        
        <TabsContent value="directory">
          {staffLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
            </div>
          ) : staffList?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffList.filter((s: any) => s.isActive).map((staff: any) => (
                <Card key={staff.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-5 flex gap-4">
                    <Avatar className="w-16 h-16 border-2 border-green-100">
                      <AvatarFallback className="bg-green-50 text-green-700 text-xl font-bold">{staff.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{staff.name}</h3>
                      <p className="text-sm font-medium text-gray-500 mb-2">{staff.type}</p>
                      
                      <div className="flex gap-2">
                        {staff.mobile && (
                          <a href={`tel:${staff.mobile}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full border-green-200 text-green-700 hover:bg-green-50">
                              <Phone className="w-3 h-3 mr-1" /> Call
                            </Button>
                          </a>
                        )}
                        <Link href={`/resident/staff/${staff.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50">
                            <CalendarDays className="w-3 h-3 mr-1" /> Calendar
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if(confirm(`Are you sure you want to remove ${staff.name}?`)) {
                              deleteStaffMutation.mutate(staff.id);
                            }
                          }}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No staff registered</h3>
              <p className="text-gray-500 max-w-sm mx-auto mt-1 mb-4">Add your daily help (maids, drivers, cooks) to track their attendance.</p>
              <Button variant="outline" onClick={() => setIsAddModalOpen(true)}>Add Staff</Button>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="report">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-green-600" />
                Monthly Summary
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={reportMonth.toString()} onValueChange={(val) => setReportMonth(parseInt(val))}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({length: 12}).map((_, i) => (
                      <SelectItem key={i+1} value={(i+1).toString()}>
                        {format(new Date(2000, i, 1), 'MMMM')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={reportYear.toString()} onValueChange={(val) => setReportYear(parseInt(val))}>
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {reportLoading ? (
                <div className="text-center py-10 animate-pulse text-gray-400">Generating report...</div>
              ) : attendanceReport?.length > 0 ? (
                <div className="space-y-6 mt-4">
                  {attendanceReport.map((staffRep: any, idx: number) => (
                    <div key={idx} className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
                            <AvatarFallback className="bg-green-100 text-green-700">{staffRep.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-bold text-gray-900">{staffRep.name}</h4>
                            <span className="text-xs font-medium text-gray-500">{staffRep.type}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">{staffRep.summary.presentDays} <span className="text-sm font-normal text-gray-500">days</span></div>
                          <div className="text-xs text-gray-500">{staffRep.summary.totalHours.toFixed(1)} hrs total</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {['S','M','T','W','T','F','S'].map((d, i) => (
                          <div key={i} className="text-center text-[10px] font-bold text-gray-400">{d}</div>
                        ))}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Records</h5>
                        <div className="space-y-2">
                          {staffRep.dailyBreakdown && staffRep.dailyBreakdown.slice(0, 5).map((rec: any, i: number) => (
                            <div key={i} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-gray-100">
                              <span className="font-medium">{format(new Date(rec.createdAt), 'MMM d, yyyy')}</span>
                              <div className="flex items-center gap-3">
                                {rec.checkInTime && <span className="text-gray-600 flex items-center gap-1"><Clock className="w-3 h-3"/> {format(new Date(rec.checkInTime), 'HH:mm')}</span>}
                                {rec.checkOutTime && <span className="text-gray-600 flex items-center gap-1 text-right w-16">- {format(new Date(rec.checkOutTime), 'HH:mm')}</span>}
                                <span className={`w-16 text-right text-xs font-bold ${rec.status === 'ABSENT' ? 'text-red-500' : 'text-green-600'}`}>{rec.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-500">No attendance data for selected month.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Staff Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Staff</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Full Name *</label>
              <Input {...register("name")} placeholder="Ramesh Kumar" />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Role *</label>
                <Select onValueChange={(val) => setValue('type', val as any)} defaultValue="MAID">
                  <SelectTrigger>
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAID">Maid</SelectItem>
                    <SelectItem value="COOK">Cook</SelectItem>
                    <SelectItem value="DRIVER">Driver</SelectItem>
                    <SelectItem value="NANNY">Nanny</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Mobile (Optional)</label>
                <Input {...register("mobile")} placeholder="9876543210" maxLength={10} />
                {errors.mobile && <p className="text-xs text-red-500">{errors.mobile.message}</p>}
              </div>
            </div>

            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={addStaffMutation.isPending}>
              {addStaffMutation.isPending ? "Registering..." : "Register Staff Member"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
