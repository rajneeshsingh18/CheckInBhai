"use client";

import { useState } from "react";
import { useReportQuery } from "@/lib/api";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Download,
  Calendar,
  FileText,
  UserCheck,
  Package,
  AlertTriangle,
  Users,
  Shield,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import StatusBadge from "@/components/shared/StatusBadge";

type ReportType = "visitors" | "deliveries" | "staff-attendance" | "sos-alerts" | "guard-activity";

export default function AdminReports() {
  const [reportType, setReportType] = useState<ReportType>("visitors");
  
  // Date filters (Default to last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo.toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  // Specific filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Construct API query parameters
  const getParams = () => {
    const params: any = {
      dateFrom: dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined,
      dateTo: dateTo ? `${dateTo}T23:59:59.999Z` : undefined
    };
    if (reportType === "visitors" && statusFilter !== "ALL") {
      params.status = statusFilter;
    }
    if (reportType === "deliveries" && categoryFilter !== "ALL") {
      params.category = categoryFilter;
    }
    return params;
  };

  const { data: reportData = [], isLoading, error } = useReportQuery(reportType, getParams());

  // Browser-side CSV Exporter
  const handleExportCSV = () => {
    if (reportData.length === 0) {
      toast.error("No data available to export");
      return;
    }

    let headers: string[] = [];
    let keys: string[] = [];
    let fileName = `rakshak_${reportType}_report.csv`;

    switch (reportType) {
      case "visitors":
        headers = ["Visitor Name", "Mobile", "Flat", "Tower", "Purpose", "Status", "Created At", "Entry Time", "ExitTime"];
        keys = ["visitor.name", "visitor.mobile", "flat.number", "flat.tower.name", "purpose", "status", "createdAt", "entryTime", "exitTime"];
        break;
      case "deliveries":
        headers = ["Category", "Courier Name", "Mobile", "Flat", "Tower", "Status", "Package Count", "Received At", "Picked Up At"];
        keys = ["category", "deliveryPersonName", "deliveryPersonMobile", "flat.number", "flat.tower.name", "status", "packageCount", "receivedAt", "pickedUpAt"];
        break;
      case "staff-attendance":
        headers = ["Staff Name", "Staff Type", "Mobile", "Flat", "Tower", "Check In Time", "Check Out Time", "Status"];
        keys = ["staff.name", "staff.type", "staff.mobile", "flat.number", "flat.tower.name", "checkInTime", "checkOutTime", "status"];
        break;
      case "sos-alerts":
        headers = ["Emergency Type", "Raised By", "Mobile", "Flat", "Tower", "Raised At", "Status", "Resolved At", "Acknowledge By"];
        keys = ["type", "raisedUser.name", "raisedUser.mobile", "flat.number", "flat.tower.name", "createdAt", "status", "resolvedAt", "acknowledgedUser.name"];
        break;
      case "guard-activity":
        headers = ["Guard Name", "Email", "Mobile", "Status", "Visitors Logged Today", "Deliveries Logged Today", "Staff Check-Ins Today", "Total Actions"];
        keys = ["name", "email", "mobile", "isOnDuty", "visitorsLogged", "deliveriesLogged", "staffCheckinsRecorded", "totalActions"];
        break;
    }

    const csvContent = convertToCSV(reportData, headers, keys);
    downloadCSV(csvContent, fileName);
  };

  const convertToCSV = (data: any[], headers: string[], keys: string[]) => {
    const csvRows = [headers.join(",")];
    
    for (const row of data) {
      const values = keys.map((key) => {
        // Resolve nested dot fields e.g., "visitor.name"
        const val = key.split(".").reduce((o, i) => (o ? o[i] : null), row);
        
        let stringVal = "";
        if (val !== null && val !== undefined) {
          if (typeof val === "boolean") {
            stringVal = val ? "ON DUTY" : "OFF DUTY";
          } else if (key.endsWith("Time") || key.endsWith("At")) {
            stringVal = format(new Date(val), "yyyy-MM-dd HH:mm:ss");
          } else {
            stringVal = String(val);
          }
        }
        
        // Escape quotes
        return `"${stringVal.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(","));
    }
    
    return csvRows.join("\n");
  };

  const downloadCSV = (csvContent: string, fileName: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV report exported successfully!");
  };

  const formatDateTime = (val?: string) => {
    if (!val) return "-";
    return format(new Date(val), "MMM d, h:mm a");
  };

  return (
    <div className="p-6 md:p-8 space-y-6 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Reports & Export Control</h1>
          <p className="text-gray-500 mt-1">Generate auditing reports and export operational data.</p>
        </div>
        <Button
          onClick={handleExportCSV}
          disabled={isLoading || reportData.length === 0}
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold shrink-0 shadow-sm"
        >
          <Download className="w-4 h-4 mr-2" /> Export to CSV
        </Button>
      </div>

      {/* Filter Rigs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        {/* Date Selector */}
        <div className="md:col-span-2">
          <Label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Reporting Date Range</Label>
          <DateRangePicker
            startDate={dateFrom}
            endDate={dateTo}
            onChange={(start, end) => {
              setDateFrom(start);
              setDateTo(end);
            }}
            className="border-0 shadow-none p-0 grid-cols-1 sm:grid-cols-2"
          />
        </div>

        {/* Feature Filters */}
        {reportType === "visitors" && (
          <div>
            <Label htmlFor="status-filter" className="text-xs font-bold text-gray-500 uppercase mb-2 block">
              Approval Status
            </Label>
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "ALL")}>
              <SelectTrigger id="status-filter" className="bg-white border-gray-300 w-full">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-white z-50">
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="EXITED">Exited</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {reportType === "deliveries" && (
          <div>
            <Label htmlFor="category-filter" className="text-xs font-bold text-gray-500 uppercase mb-2 block">
              Delivery Carrier
            </Label>
            <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val || "ALL")}>
              <SelectTrigger id="category-filter" className="bg-white border-gray-300 w-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="bg-white z-50">
                <SelectItem value="ALL">All Categories</SelectItem>
                <SelectItem value="Amazon">Amazon</SelectItem>
                <SelectItem value="Flipkart">Flipkart</SelectItem>
                <SelectItem value="Zomato">Zomato</SelectItem>
                <SelectItem value="Swiggy">Swiggy</SelectItem>
                <SelectItem value="Dunzo">Dunzo</SelectItem>
                <SelectItem value="Courier">Other Courier</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Report Type Selector Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto no-scrollbar gap-5 text-sm font-semibold">
        {([
          { id: "visitors", label: "Visitors", icon: <UserCheck className="w-4 h-4" /> },
          { id: "deliveries", label: "Deliveries", icon: <Package className="w-4 h-4" /> },
          { id: "staff-attendance", label: "Staff Attendance", icon: <Users className="w-4 h-4" /> },
          { id: "sos-alerts", label: "SOS Alerts", icon: <AlertTriangle className="w-4 h-4" /> },
          { id: "guard-activity", label: "Guard Activity", icon: <Shield className="w-4 h-4" /> }
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setReportType(tab.id);
              setStatusFilter("ALL");
              setCategoryFilter("ALL");
            }}
            className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-bold whitespace-nowrap transition-colors ${
              reportType === tab.id
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Report Table View */}
      <Card className="border border-gray-200 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-2">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
              <p className="text-xs">Generating report data...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center text-red-500 text-sm">
              Failed to load report. Please make sure the backend services are running.
            </div>
          ) : reportData.length === 0 ? (
            <div className="py-20 text-center text-gray-400">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold">No records match the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                {/* 1. VISITORS TABLE */}
                {reportType === "visitors" && (
                  <>
                    <TableHeader className="bg-gray-50 border-b border-gray-200">
                      <TableRow>
                        <TableHead className="font-bold text-gray-700">Visitor</TableHead>
                        <TableHead className="font-bold text-gray-700">Mobile</TableHead>
                        <TableHead className="font-bold text-gray-700">Flat</TableHead>
                        <TableHead className="font-bold text-gray-700">Purpose</TableHead>
                        <TableHead className="font-bold text-gray-700">Status</TableHead>
                        <TableHead className="font-bold text-gray-700">Entry Time</TableHead>
                        <TableHead className="font-bold text-gray-700">Exit Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((e: any) => (
                        <TableRow key={e.id} className="hover:bg-gray-50/50">
                          <TableCell className="font-semibold text-gray-900">{e.visitor?.name}</TableCell>
                          <TableCell className="text-gray-600">{e.visitor?.mobile}</TableCell>
                          <TableCell className="font-semibold text-gray-800">
                            {e.flat?.tower?.name ? `${e.flat.tower.name} - ` : ""}Flat {e.flat?.number}
                          </TableCell>
                          <TableCell className="capitalize text-gray-700">{e.purpose || "Personal"}</TableCell>
                          <TableCell><StatusBadge status={e.status} /></TableCell>
                          <TableCell className="text-xs text-gray-500">{formatDateTime(e.entryTime || e.createdAt)}</TableCell>
                          <TableCell className="text-xs text-gray-500">{formatDateTime(e.exitTime)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                )}

                {/* 2. DELIVERIES TABLE */}
                {reportType === "deliveries" && (
                  <>
                    <TableHeader className="bg-gray-50 border-b border-gray-200">
                      <TableRow>
                        <TableHead className="font-bold text-gray-700">Category</TableHead>
                        <TableHead className="font-bold text-gray-700">Courier Partner</TableHead>
                        <TableHead className="font-bold text-gray-700">Flat</TableHead>
                        <TableHead className="font-bold text-gray-700">Status</TableHead>
                        <TableHead className="font-bold text-gray-700 text-center">Packages</TableHead>
                        <TableHead className="font-bold text-gray-700">Received At</TableHead>
                        <TableHead className="font-bold text-gray-700">Picked Up At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((d: any) => (
                        <TableRow key={d.id} className="hover:bg-gray-50/50">
                          <TableCell className="font-semibold text-gray-900">{d.category}</TableCell>
                          <TableCell className="text-gray-700">{d.deliveryPersonName || "Courier Handover"}</TableCell>
                          <TableCell className="font-semibold text-gray-800">
                            {d.flat?.tower?.name ? `${d.flat.tower.name} - ` : ""}Flat {d.flat?.number}
                          </TableCell>
                          <TableCell><StatusBadge status={d.status} /></TableCell>
                          <TableCell className="text-center font-semibold text-gray-800">{d.packageCount}</TableCell>
                          <TableCell className="text-xs text-gray-500">{formatDateTime(d.receivedAt)}</TableCell>
                          <TableCell className="text-xs text-gray-500">{formatDateTime(d.pickedUpAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                )}

                {/* 3. STAFF ATTENDANCE TABLE */}
                {reportType === "staff-attendance" && (
                  <>
                    <TableHeader className="bg-gray-50 border-b border-gray-200">
                      <TableRow>
                        <TableHead className="font-bold text-gray-700">Staff Name</TableHead>
                        <TableHead className="font-bold text-gray-700">Type</TableHead>
                        <TableHead className="font-bold text-gray-700">Flat</TableHead>
                        <TableHead className="font-bold text-gray-700">Check In</TableHead>
                        <TableHead className="font-bold text-gray-700">Check Out</TableHead>
                        <TableHead className="font-bold text-gray-700">Attendance Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((a: any) => (
                        <TableRow key={a.id} className="hover:bg-gray-50/50">
                          <TableCell className="font-semibold text-gray-900">{a.staff?.name}</TableCell>
                          <TableCell className="capitalize text-orange-700 font-semibold text-xs">{a.staff?.type}</TableCell>
                          <TableCell className="font-semibold text-gray-800">
                            {a.flat?.tower?.name ? `${a.flat.tower.name} - ` : ""}Flat {a.flat?.number}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">{formatDateTime(a.checkInTime)}</TableCell>
                          <TableCell className="text-xs text-gray-500">{formatDateTime(a.checkOutTime)}</TableCell>
                          <TableCell><StatusBadge status={a.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                )}

                {/* 4. SOS ALERTS TABLE */}
                {reportType === "sos-alerts" && (
                  <>
                    <TableHeader className="bg-gray-50 border-b border-gray-200">
                      <TableRow>
                        <TableHead className="font-bold text-gray-700">Alert Type</TableHead>
                        <TableHead className="font-bold text-gray-700">Flat Location</TableHead>
                        <TableHead className="font-bold text-gray-700">Raised By</TableHead>
                        <TableHead className="font-bold text-gray-700">Raised At</TableHead>
                        <TableHead className="font-bold text-gray-700">Status</TableHead>
                        <TableHead className="font-bold text-gray-700">Resolved At</TableHead>
                        <TableHead className="font-bold text-gray-700">Acknowledge By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((s: any) => (
                        <TableRow key={s.id} className="hover:bg-gray-50/50">
                          <TableCell>
                            <Badge variant="destructive" className="font-extrabold text-[10px] tracking-wider uppercase bg-red-100 text-red-800 border-red-200">
                              {s.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-gray-800">
                            {s.flat?.tower?.name ? `${s.flat.tower.name} - ` : ""}Flat {s.flat?.number} ({s.location})
                          </TableCell>
                          <TableCell className="font-semibold text-gray-900">{s.raisedUser?.name}</TableCell>
                          <TableCell className="text-xs text-gray-500">{formatDateTime(s.createdAt)}</TableCell>
                          <TableCell>
                            <Badge className={s.status === "RESOLVED" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800 animate-pulse"}>
                              {s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">{formatDateTime(s.resolvedAt)}</TableCell>
                          <TableCell className="text-gray-700 font-semibold">{s.acknowledgedUser?.name || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                )}

                {/* 5. GUARD ACTIVITY TABLE */}
                {reportType === "guard-activity" && (
                  <>
                    <TableHeader className="bg-gray-50 border-b border-gray-200">
                      <TableRow>
                        <TableHead className="font-bold text-gray-700">Guard Name</TableHead>
                        <TableHead className="font-bold text-gray-700">Contact</TableHead>
                        <TableHead className="font-bold text-gray-700 text-center">Status</TableHead>
                        <TableHead className="font-bold text-gray-700 text-right">Visitors Logged</TableHead>
                        <TableHead className="font-bold text-gray-700 text-right">Deliveries Logged</TableHead>
                        <TableHead className="font-bold text-gray-700 text-right">Staff Check-Ins</TableHead>
                        <TableHead className="font-bold text-gray-700 text-right">Total Activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((g: any) => (
                        <TableRow key={g.guardId} className="hover:bg-gray-50/50">
                          <TableCell className="font-semibold text-gray-900">{g.name}</TableCell>
                          <TableCell className="text-xs text-gray-500">
                            <div>{g.email}</div>
                            <div>{g.mobile}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            {g.isOnDuty ? (
                              <Badge className="bg-green-100 text-green-800">On Duty</Badge>
                            ) : (
                              <Badge variant="secondary">Off Duty</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-gray-800 font-medium">{g.visitorsLogged}</TableCell>
                          <TableCell className="text-right text-gray-800 font-medium">{g.deliveriesLogged}</TableCell>
                          <TableCell className="text-right text-gray-800 font-medium">{g.staffCheckinsRecorded}</TableCell>
                          <TableCell className="text-right font-black text-orange-600">{g.totalActions}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                )}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
