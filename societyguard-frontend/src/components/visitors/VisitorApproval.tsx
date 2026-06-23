"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { Clock, CheckCircle, XCircle, Search, UserSquare } from "lucide-react";

export default function VisitorApproval() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [otp, setOtp] = useState("");
  const [reason, setReason] = useState("");

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['visitorHistory', 'PENDING'],
    queryFn: async () => {
      const res = await api.get('/visitors/history', { params: { status: 'PENDING' } });
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['visitorHistory', activeTab],
    queryFn: async () => {
      const status = activeTab === "all" ? undefined : activeTab.toUpperCase();
      const res = await api.get('/visitors/history', { params: { status } });
      return res.data.data;
    },
    enabled: activeTab !== "pending",
  });

  const actionMutation = useMutation({
    mutationFn: async ({ entryId, type, otpVal, reasonVal }: any) => {
      const res = await api.post(`/visitors/${type}`, { 
        entryId, 
        otp: otpVal, 
        ...(type === 'reject' && { reason: reasonVal }) 
      });
      return res.data;
    },
    onSuccess: (data, variables) => {
      toast.success(`Visitor ${variables.type === 'approve' ? 'approved' : 'rejected'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['visitorHistory'] });
      queryClient.invalidateQueries({ queryKey: ['residentDashboard'] });
      setSelectedEntry(null);
      setActionType(null);
      setOtp("");
      setReason("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || `Failed to ${actionType} visitor`);
    }
  });

  const handleAction = () => {
    if (!otp) {
      toast.error("Please enter the OTP sent to your phone");
      return;
    }
    actionMutation.mutate({ 
      entryId: selectedEntry.id, 
      type: actionType, 
      otpVal: otp, 
      reasonVal: reason 
    });
  };

  const renderList = (entries: any[], isLoading: boolean) => {
    if (isLoading) return <div className="text-center py-10 text-gray-500 animate-pulse">Loading...</div>;
    if (!entries || entries.length === 0) return <div className="text-center py-10 text-gray-500">No visitors found.</div>;

    const filtered = entries.filter((e: any) => e.visitor.name.toLowerCase().includes(search.toLowerCase()));

    return (
      <div className="space-y-4">
        {filtered.map((entry: any) => (
          <Card key={entry.id} className={`overflow-hidden shadow-sm ${entry.status === 'PENDING' ? 'border-orange-200 bg-orange-50/20' : ''}`}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                <div className="flex items-start gap-4">
                  <Avatar className="w-16 h-16 border-2 border-gray-100">
                    <AvatarImage src={entry.visitor.photoUrl} />
                    <AvatarFallback className="bg-gray-100 text-gray-700 text-xl">{entry.visitor.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{entry.visitor.name}</h3>
                    <p className="text-sm text-gray-600">{entry.visitor.mobile} {entry.purpose && `• ${entry.purpose}`}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        <Clock className="w-3 h-3" /> {format(new Date(entry.createdAt), "MMM d, h:mm a")}
                      </span>
                      {entry.status !== 'PENDING' && (
                        <span className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded ${
                          entry.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                          entry.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {entry.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {entry.status === 'PENDING' && (
                  <div className="flex sm:flex-col gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                    <Button 
                      className="flex-1 sm:w-32 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => { setSelectedEntry(entry); setActionType('approve'); }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Approve
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 sm:w-32 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => { setSelectedEntry(entry); setActionType('reject'); }}
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserSquare className="w-6 h-6 text-orange-600" />
            Visitor Approvals
          </h1>
          <p className="text-gray-500">Manage pending guests and view history</p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input 
          placeholder="Search visitors by name..." 
          className="pl-10 h-12 text-base"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full h-12 mb-6">
          <TabsTrigger value="pending" className="relative h-10">
            Pending
            {pendingData?.entries?.length > 0 && (
              <span className="ml-2 bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {pendingData.entries.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="h-10">Approved</TabsTrigger>
          <TabsTrigger value="rejected" className="h-10">Rejected</TabsTrigger>
          <TabsTrigger value="all" className="h-10">All History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending">
          {renderList(pendingData?.entries || [], pendingLoading)}
        </TabsContent>
        <TabsContent value="approved">
          {renderList(historyData?.entries || [], historyLoading)}
        </TabsContent>
        <TabsContent value="rejected">
          {renderList(historyData?.entries || [], historyLoading)}
        </TabsContent>
        <TabsContent value="all">
          {renderList(historyData?.entries || [], historyLoading)}
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={!!selectedEntry && !!actionType} onOpenChange={(open) => { if(!open) { setSelectedEntry(null); setActionType(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={actionType === 'approve' ? 'text-green-600' : 'text-red-600'}>
              {actionType === 'approve' ? 'Approve Visitor' : 'Reject Visitor'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' 
                ? `You are approving entry for ${selectedEntry?.visitor?.name}.` 
                : `You are rejecting entry for ${selectedEntry?.visitor?.name}.`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Enter OTP</label>
              <Input 
                placeholder="6-digit OTP received via SMS" 
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className="text-center tracking-widest text-lg font-mono"
              />
              <p className="text-xs text-gray-500 text-center">Check your phone for the authorization OTP</p>
            </div>

            {actionType === 'reject' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Reason (Optional)</label>
                <Input 
                  placeholder="e.g., Not expecting anyone" 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setSelectedEntry(null); setActionType(null); }} className="flex-1">
              Cancel
            </Button>
            <Button 
              className={`flex-1 ${actionType === 'approve' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
              onClick={handleAction}
              disabled={actionMutation.isPending || !otp}
            >
              {actionMutation.isPending ? "Processing..." : `Confirm ${actionType}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
