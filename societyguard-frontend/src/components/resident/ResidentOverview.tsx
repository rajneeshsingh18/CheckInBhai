"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  AlertTriangle, 
  UserSquare, 
  Package, 
  Users, 
  PlusCircle, 
  QrCode, 
  Clock, 
  CheckCircle, 
  XCircle,
  ChevronRight,
  Phone
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ResidentOverview() {
  const queryClient = useQueryClient();
  const [sosProgress, setSosProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['residentDashboard'],
    queryFn: async () => {
      const res = await api.get('/dashboard/resident');
      return res.data.data;
    },
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
  });

  const sosMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/sos', {
        type: 'SECURITY',
        location: 'Resident App Trigger',
        description: 'SOS Triggered from Dashboard'
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("SOS Alert Sent! Guards have been notified.", {
        style: { background: '#ef4444', color: 'white', border: 'none' }
      });
      queryClient.invalidateQueries({ queryKey: ['residentDashboard'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to trigger SOS");
    }
  });

  const approveVisitorMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: 'approve' | 'reject' }) => {
      const res = await api.post(`/visitors/${status}`, { entryId: id, otp: '123456', reason: 'Dashboard action' });
      return res.data;
    },
    onSuccess: (data, variables) => {
      toast.success(`Visitor ${variables.status === 'approve' ? 'approved' : 'rejected'}`);
      queryClient.invalidateQueries({ queryKey: ['residentDashboard'] });
    }
  });

  // SOS Press & Hold Logic
  const startPress = () => {
    setIsPressing(true);
    setSosProgress(0);
    
    // Update progress bar every 30ms
    progressInterval.current = setInterval(() => {
      setSosProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval.current!);
          return 100;
        }
        return prev + 1; // 100 steps in 3000ms = 30ms per step
      });
    }, 30);

    // Trigger after 3 seconds
    pressTimer.current = setTimeout(() => {
      clearInterval(progressInterval.current!);
      setSosProgress(100);
      setIsPressing(false);
      sosMutation.mutate();
    }, 3000);
  };

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (progressInterval.current) clearInterval(progressInterval.current);
    setIsPressing(false);
    setSosProgress(0);
  };

  useEffect(() => {
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 space-y-6 animate-pulse">
        <div className="h-40 bg-gray-200 rounded-xl"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  const { actionRequired, todayActivity, staff, emergency, recentVisitors } = data || {};

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resident Dashboard</h1>
          <p className="text-gray-500">Overview of your flat's activity</p>
        </div>
      </div>

      {/* SOS Emergency Button Section */}
      <Card className={`border-2 overflow-hidden transition-colors ${emergency?.hasActiveAlert ? 'border-red-500 bg-red-50' : 'border-red-200 bg-white'}`}>
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <h2 className="text-xl font-bold text-red-600 flex items-center justify-center md:justify-start gap-2 mb-2">
              <AlertTriangle className="w-6 h-6" />
              {emergency?.hasActiveAlert ? "ACTIVE EMERGENCY" : "Emergency SOS"}
            </h2>
            <p className="text-gray-600 max-w-md">
              {emergency?.hasActiveAlert 
                ? "An SOS alert is currently active for your flat. Responders have been notified."
                : "Press and hold the button for 3 seconds to immediately alert the main gate and society admins."}
            </p>
          </div>
          
          <div className="relative">
            <button
              onMouseDown={startPress}
              onMouseUp={cancelPress}
              onMouseLeave={cancelPress}
              onTouchStart={startPress}
              onTouchEnd={cancelPress}
              disabled={emergency?.hasActiveAlert || sosMutation.isPending}
              className={`w-32 h-32 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-transform ${
                emergency?.hasActiveAlert || sosMutation.isPending
                  ? 'bg-red-400 cursor-not-allowed scale-95 opacity-80'
                  : isPressing 
                    ? 'bg-red-700 scale-95 shadow-inner' 
                    : 'bg-red-600 hover:bg-red-700 hover:scale-105 active:scale-95 shadow-red-500/40'
              }`}
            >
              <AlertTriangle className="w-10 h-10 mb-1" />
              <span className="font-bold tracking-widest">SOS</span>
            </button>
            
            {/* Progress Ring Overlay */}
            {isPressing && (
              <svg className="absolute inset-0 w-32 h-32 pointer-events-none transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="60"
                  fill="transparent"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="8"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="60"
                  fill="transparent"
                  stroke="white"
                  strokeWidth="8"
                  strokeDasharray={377} // 2 * pi * r (60)
                  strokeDashoffset={377 - (377 * sosProgress) / 100}
                  className="transition-all duration-75"
                />
              </svg>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      {actionRequired?.pendingApprovals?.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Pending Approvals ({actionRequired.pendingVisitorCount})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {actionRequired.pendingApprovals.map((entry: any) => (
              <Card key={entry.id} className="border-orange-200 bg-orange-50/30 overflow-hidden shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-12 h-12 border-2 border-orange-100">
                      <AvatarImage src={entry.visitor.photoUrl} />
                      <AvatarFallback className="bg-orange-100 text-orange-700">{entry.visitor.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{entry.visitor.name}</h3>
                      <p className="text-sm text-gray-500 truncate">{entry.visitor.mobile}</p>
                      <div className="flex items-center gap-1 text-xs text-orange-600 mt-1 font-medium bg-orange-100/50 w-fit px-2 py-0.5 rounded">
                        <Clock className="w-3 h-3" />
                        {format(new Date(entry.createdAt), "hh:mm a")}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => approveVisitorMutation.mutate({ id: entry.id, status: 'reject' })}
                      disabled={approveVisitorMutation.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => approveVisitorMutation.mutate({ id: entry.id, status: 'approve' })}
                      disabled={approveVisitorMutation.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
              <UserSquare className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{recentVisitors?.length || 0}</p>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Today's Visitors</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
              <Package className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{todayActivity?.deliveriesCount || 0}</p>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Deliveries</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{staff?.todayStatus?.filter((s:any)=>s.status==='CHECKED_IN').length || 0}</p>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Present</p>
          </CardContent>
        </Card>

        <Link href="/resident/passes" className="block h-full">
          <Card className="h-full border-dashed border-2 hover:border-orange-400 hover:bg-orange-50/50 transition-colors cursor-pointer group">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
              <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <PlusCircle className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-orange-700">New Pass</p>
              <p className="text-xs font-medium text-gray-500 mt-1">Pre-approve guest</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staff Status Widget */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-500" />
                Staff Status
              </CardTitle>
              <Link href="/resident/staff" className="text-xs text-orange-600 hover:underline font-medium">View All</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {staff?.todayStatus?.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {staff.todayStatus.map((s: any, idx: number) => (
                  <li key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-gray-100 text-gray-600">{s.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.type}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        s.status === 'CHECKED_IN' ? 'bg-green-100 text-green-700' :
                        s.status === 'CHECKED_OUT' ? 'bg-gray-100 text-gray-600' :
                        s.status === 'ABSENT' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {s.status === 'CHECKED_IN' ? `In since ${s.time}` : 
                         s.status === 'CHECKED_OUT' ? 'Left for day' : 
                         s.status === 'ABSENT' ? 'Absent' : 'Not arrived'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm mb-4">No staff registered for your flat.</p>
                <Link href="/resident/staff">
                  <Button variant="outline" size="sm">Register Staff</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Timeline */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-500" />
                Recent Visitors
              </CardTitle>
              <Link href="/resident/visitors" className="text-xs text-orange-600 hover:underline font-medium">History</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentVisitors?.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {recentVisitors.map((entry: any) => (
                  <li key={entry.id} className="p-4 flex items-start gap-4">
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      entry.status === 'APPROVED' ? 'bg-green-500' :
                      entry.status === 'PENDING' ? 'bg-yellow-500' :
                      entry.status === 'REJECTED' ? 'bg-red-500' :
                      'bg-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-semibold">{entry.visitor.name}</span> visited 
                        {entry.purpose && <span className="text-gray-600"> for {entry.purpose}</span>}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {format(new Date(entry.createdAt), "MMM d, h:mm a")} • {entry.status}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm">No recent visitors</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
