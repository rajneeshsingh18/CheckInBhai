"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { List, Search, RefreshCw, Clock, Phone, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

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
}

export default function ActivityPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["today-logs", search, status, page],
    queryFn: async () => {
      const statusParam = status === "ALL" ? "" : `&status=${status}`;
      const searchParam = search ? `&search=${search}` : "";
      const res = await api.get(`/visitors/today?page=${page}&limit=10${statusParam}${searchParam}`);
      return res.data.data; // { entries, total, pages }
    },
  });

  const recordExitMutation = useMutation({
    mutationFn: async (entryId: string) => {
      await api.post(`/visitors/exit/${entryId}`);
    },
    onSuccess: () => {
      toast.success("Visitor exit recorded.");
      queryClient.invalidateQueries({ queryKey: ["today-logs"] });
      queryClient.invalidateQueries({ queryKey: ["guard-stats"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || "Failed to record exit");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-amber-50 border border-amber-200 text-amber-700">Pending</span>;
      case "PRE_APPROVED":
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-blue-50 border border-blue-200 text-blue-700">Pre-Approved</span>;
      case "APPROVED":
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">Approved</span>;
      case "REJECTED":
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-red-50 border border-red-200 text-red-700">Rejected</span>;
      case "EXITED":
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-neutral-100 border border-neutral-200 text-neutral-600">Exited</span>;
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-neutral-50 border border-neutral-200 text-neutral-500">{status}</span>;
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const entries: VisitorEntry[] = data?.entries || [];
  const totalPages = data?.pages || 1;

  return (
    <div className="max-w-lg mx-auto bg-white rounded-3xl shadow-xl shadow-neutral-100 overflow-hidden border border-neutral-100 pb-12">
      {/* Header */}
      <div className="bg-[#0b0f1a] text-white p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <List className="w-6 h-6 text-orange-500" /> Today's Visitor Logs
          </h2>
          <p className="text-neutral-400 text-sm mt-1">Search or filter today's entries</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col gap-2.5">
          <div className="relative">
            <Search className="w-5 h-5 text-neutral-400 absolute left-4 top-3.5" />
            <Input
              placeholder="Search by visitor name or mobile..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-12 h-12 rounded-2xl bg-neutral-50 border-neutral-200 text-base focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-grow">
              <Select
                value={status}
                onValueChange={(val) => {
                  setStatus(val || "ALL");
                  setPage(1);
                }}
              >

                <SelectTrigger className="h-12 rounded-2xl bg-neutral-50 border-neutral-200">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="ALL">🔍 All Statuses</SelectItem>
                  <SelectItem value="PENDING">⏳ Pending</SelectItem>
                  <SelectItem value="APPROVED">✅ Approved</SelectItem>
                  <SelectItem value="REJECTED">❌ Rejected</SelectItem>
                  <SelectItem value="EXITED">🚪 Exited</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => refetch()}
              className="h-12 w-12 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white flex items-center justify-center p-0"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-orange-600 animate-spin mb-3" />
            <p className="text-neutral-500 text-sm">Loading logs...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-red-50 border border-red-100 rounded-3xl">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <p className="text-red-950 font-bold text-sm">Failed to load logs</p>
          </div>
        ) : entries.length > 0 ? (
          <div className="space-y-2.5">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white border border-neutral-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center font-bold text-neutral-600 text-sm">
                    {entry.visitor.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900 text-sm">{entry.visitor.name}</h4>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Flat {entry.flat.tower.name}-{entry.flat.number} • {entry.purpose}
                    </p>
                    <p className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1 font-medium">
                      <Phone className="w-3 h-3" /> {entry.visitor.mobile}
                    </p>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-1.5">
                  {getStatusBadge(entry.status)}
                  <span className="text-[10px] text-neutral-400 font-semibold flex items-center gap-0.5">
                    <Clock className="w-3 h-3 text-neutral-300" /> {formatTime(entry.createdAt)}
                  </span>
                  
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
            ))}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                <Button
                  variant="outline"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="rounded-xl h-10 px-4 flex items-center gap-1 text-xs"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Button>
                <span className="text-xs text-neutral-500 font-bold">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="rounded-xl h-10 px-4 flex items-center gap-1 text-xs"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-neutral-400 bg-neutral-50/50 border border-dashed border-neutral-100 rounded-3xl">
            No visitor logs matched search parameters.
          </div>
        )}
      </div>
    </div>
  );
}
