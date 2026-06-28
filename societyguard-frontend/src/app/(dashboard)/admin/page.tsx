"use client";

import { useAdminOverview, useVisitorAnalytics, useGuardPerformance, useAcknowledgeAlert, useResolveAlert } from "@/lib/api";
import StatCard from "@/components/shared/StatCard";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import ErrorState from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Building2,
  Users,
  Shield,
  UserCheck,
  Package,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  LayoutGrid,
  FileBarChart,
  Sliders,
  Settings,
  AlertCircle
} from "lucide-react";
import Link from "next/navigation";
import LinkComponent from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import { useState } from "react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Input } from "@/components/ui/input";

export default function AdminDashboard() {
  const { data: overview, isLoading: overLoading, error: overError, refetch: refetchOver } = useAdminOverview();
  const { data: analytics, isLoading: chartLoading, error: chartError, refetch: refetchCharts } = useVisitorAnalytics();
  const { data: guards, isLoading: guardLoading, error: guardError, refetch: refetchGuards } = useGuardPerformance();

  const ackSOS = useAcknowledgeAlert();
  const resolveSOS = useResolveAlert();

  const [activeSOSId, setActiveSOSId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAcknowledge = async (id: string) => {
    await ackSOS.mutateAsync(id);
    refetchOver();
  };

  const handleResolveOpen = (id: string) => {
    setActiveSOSId(id);
    setResolveNote("");
    setDialogOpen(true);
  };

  const handleResolveConfirm = async () => {
    if (!activeSOSId) return;
    await resolveSOS.mutateAsync({ alertId: activeSOSId, resolutionNotes: resolveNote });
    setDialogOpen(false);
    setActiveSOSId(null);
    refetchOver();
  };

  const refreshAll = () => {
    refetchOver();
    refetchCharts();
    refetchGuards();
  };

  if (overLoading || chartLoading || guardLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6">
        <LoadingSkeleton type="stat" count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LoadingSkeleton type="card" count={2} />
        </div>
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  if (overError || chartError || guardError) {
    return (
      <div className="p-6 md:p-8">
        <ErrorState
          message="Could not load admin dashboard aggregates. Please check your backend connection."
          onRetry={refreshAll}
        />
      </div>
    );
  }

  const activeSOS = overview?.activeSOSAlerts || [];

  return (
    <div className="p-6 md:p-8 space-y-8 bg-gray-50/50 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Society Operations Control</h1>
          <p className="text-gray-500 mt-1">Real-time supervision and logs overview.</p>
        </div>
        <Button onClick={refreshAll} variant="outline" className="border-gray-300 font-semibold bg-white">
          Refresh Live Data
        </Button>
      </div>

      {/* Emergency Active SOS Alerts */}
      {activeSOS.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 shadow-sm space-y-4 animate-pulse">
          <div className="flex items-center space-x-3 text-red-700">
            <AlertCircle className="w-7 h-7 text-red-600 animate-spin" />
            <div>
              <h3 className="text-lg font-black tracking-tight uppercase">CRITICAL: ACTIVE EMERGENCY ALERT</h3>
              <p className="text-xs font-semibold text-red-600">Immediate response required. Notify emergency contacts.</p>
            </div>
          </div>

          <div className="divide-y divide-red-200/50">
            {activeSOS.map((sos: any) => (
              <div key={sos.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 first:pt-0 last:pb-0">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Badge variant="destructive" className="font-extrabold text-[10px] tracking-wider uppercase">
                      {sos.type}
                    </Badge>
                    <span className="font-bold text-gray-900 text-sm">
                      Flat {sos.flat?.number} ({sos.location})
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 font-medium">
                    Raised by: <span className="font-bold text-gray-900">{sos.raisedUser?.name}</span> ({sos.raisedUser?.mobile})
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Raised at: {new Date(sos.createdAt).toLocaleTimeString()}
                  </p>
                </div>

                <div className="flex space-x-2 shrink-0">
                  {sos.status === "ACTIVE" ? (
                    <Button
                      size="sm"
                      onClick={() => handleAcknowledge(sos.id)}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold"
                    >
                      Acknowledge
                    </Button>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 mr-2">
                      Acknowledged (In Progress)
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResolveOpen(sos.id)}
                    className="border-red-200 text-red-700 hover:bg-red-100/50 font-bold bg-white"
                  >
                    Resolve Alert
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Society Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
        <StatCard
          label="Total Flats"
          value={overview?.totalFlats || 0}
          icon={<Building2 className="w-5 h-5 text-orange-600" />}
          description="Registered homes"
        />
        <StatCard
          label="Total Residents"
          value={overview?.totalResidents || 0}
          icon={<Users className="w-5 h-5 text-orange-600" />}
          description="Occupying members"
        />
        <StatCard
          label="Guards On Duty"
          value={overview?.activeGuards || 0}
          icon={<Shield className="w-5 h-5 text-orange-600" />}
          description="Active shift patrols"
        />
        <StatCard
          label="Today's Visitors"
          value={overview?.todayVisitors || 0}
          icon={<UserCheck className="w-5 h-5 text-orange-600" />}
          description={`${overview?.pendingApprovals || 0} pending approvals`}
          trend={{ value: `${overview?.pendingApprovals || 0} pending`, isPositive: false }}
        />
      </div>

      {/* Quick Actions Shortcuts */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4 tracking-tight">Quick Shortcuts</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <LinkComponent href="/admin/society" className="flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all group">
            <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors mr-3 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">Flats & Towers</p>
              <span className="text-xs text-gray-500">Configure layout</span>
            </div>
          </LinkComponent>

          <LinkComponent href="/admin/guards" className="flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all group">
            <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors mr-3 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">Guards Shifts</p>
              <span className="text-xs text-gray-500">PINs & duty logs</span>
            </div>
          </LinkComponent>

          <LinkComponent href="/admin/reports" className="flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all group">
            <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors mr-3 shrink-0">
              <FileBarChart className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">Reports & CSV</p>
              <span className="text-xs text-gray-500">Export analytics</span>
            </div>
          </LinkComponent>

          <div className="flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all group cursor-pointer">
            <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors mr-3 shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">Settings</p>
              <span className="text-xs text-gray-500">Society details</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visitor Analytics charts (Last 7 Days) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Visitors Trend Line Chart */}
        <Card className="border border-gray-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-gray-900">Visitor Trends</CardTitle>
            <CardDescription>Daily visitor footfall over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.dailyVisitors || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ background: "#FFF", borderRadius: "8px", border: "1px solid #E5E7EB" }} />
                <Line type="monotone" dataKey="visitors" stroke="#EA580C" strokeWidth={3} activeDot={{ r: 6 }} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Visitors by Purpose Bar Chart */}
        <Card className="border border-gray-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-gray-900">Traffic by Purpose</CardTitle>
            <CardDescription>Visitor distribution classified by category</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.byPurpose || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="purpose" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ background: "#FFF", borderRadius: "8px", border: "1px solid #E5E7EB" }} />
                <Bar dataKey="count" fill="#EA580C" radius={[4, 4, 0, 0]} maxBarSize={45} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Guard Performance Leaderboard */}
      <Card className="border border-gray-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-gray-900">Guard Shift Performance</CardTitle>
            <CardDescription>Activities logged by security staff on duty today</CardDescription>
          </div>
          <LinkComponent href="/admin/guards" className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center">
            Manage Guards <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </LinkComponent>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50 border-b border-gray-200">
              <TableRow>
                <TableHead className="font-bold text-gray-700">Guard Name</TableHead>
                <TableHead className="font-bold text-gray-700 text-center">Status</TableHead>
                <TableHead className="font-bold text-gray-700 text-right">Visitors Logged</TableHead>
                <TableHead className="font-bold text-gray-700 text-right">Deliveries Logged</TableHead>
                <TableHead className="font-bold text-gray-700 text-right">Staff Check-Ins</TableHead>
                <TableHead className="font-bold text-gray-700 text-right">Total Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-sm text-gray-400">
                    No active guard rosters defined.
                  </TableCell>
                </TableRow>
              ) : (
                guards.map((guard: any) => (
                  <TableRow key={guard.id} className="hover:bg-gray-50/50">
                    <TableCell className="font-semibold text-gray-900">{guard.name}</TableCell>
                    <TableCell className="text-center">
                      {guard.isOnDuty ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-semibold">On Duty</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-500 text-xs font-semibold">Off Duty</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-gray-800">{guard.entriesLogged}</TableCell>
                    <TableCell className="text-right text-gray-800">{guard.deliveriesLogged}</TableCell>
                    <TableCell className="text-right text-gray-800">{guard.checkinsRecorded}</TableCell>
                    <TableCell className="text-right font-bold text-orange-600">{guard.totalActivity}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SOS Resolution Notes Dialog */}
      <ConfirmDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Resolve SOS Alert"
        description="Provide resolution notes explaining the outcome of this emergency incident before closing the alert."
        onConfirm={handleResolveConfirm}
        confirmLabel="Close Alert"
      >
        <div className="py-3">
          <Input
            placeholder="E.g., false alarm, medical responder arrived, security cleared site"
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            className="w-full text-sm border-gray-300 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
