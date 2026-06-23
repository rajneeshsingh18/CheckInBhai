"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Package, Clock, CheckCircle, Search, ShoppingBag, Utensils, Box } from "lucide-react";

export default function ResidentDeliveries() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [otp, setOtp] = useState("");

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['deliveries', 'RECEIVED'],
    queryFn: async () => {
      const res = await api.get('/deliveries/history', { params: { status: 'RECEIVED' } });
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['deliveries', 'history'],
    queryFn: async () => {
      const res = await api.get('/deliveries/history');
      return res.data.data;
    },
    enabled: activeTab !== "pending",
  });

  const pickupMutation = useMutation({
    mutationFn: async ({ deliveryId, otpVal }: { deliveryId: string, otpVal: string }) => {
      const res = await api.post(`/deliveries/pickup`, { deliveryId, otp: otpVal });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Delivery marked as picked up!");
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['residentDashboard'] });
      setSelectedDelivery(null);
      setOtp("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to confirm pickup");
    }
  });

  const handlePickup = () => {
    if (!otp) {
      toast.error("Please enter the pickup OTP");
      return;
    }
    pickupMutation.mutate({ deliveryId: selectedDelivery.id, otpVal: otp });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'SWIGGY':
      case 'ZOMATO':
        return <Utensils className="w-6 h-6 text-orange-500" />;
      case 'AMAZON':
      case 'FLIPKART':
        return <ShoppingBag className="w-6 h-6 text-blue-500" />;
      default:
        return <Box className="w-6 h-6 text-gray-500" />;
    }
  };

  const renderList = (deliveries: any[], isLoading: boolean, showActions: boolean) => {
    if (isLoading) return <div className="text-center py-10 text-gray-500 animate-pulse">Loading deliveries...</div>;
    if (!deliveries || deliveries.length === 0) return <div className="text-center py-10 text-gray-500">No deliveries found.</div>;

    return (
      <div className="space-y-4">
        {deliveries.map((delivery: any) => {
          const isFood = ['SWIGGY', 'ZOMATO'].includes(delivery.category);
          const isPending = delivery.status === 'RECEIVED';
          
          return (
            <Card key={delivery.id} className={`overflow-hidden shadow-sm ${isPending ? 'border-blue-200 bg-blue-50/20' : ''}`}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 ${isPending ? 'bg-white border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
                      {getCategoryIcon(delivery.category)}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 capitalize">{delivery.category.toLowerCase()} Delivery</h3>
                      <p className="text-sm text-gray-600">
                        {delivery.deliveryPersonName} • {delivery.packageCount} Package{delivery.packageCount > 1 ? 's' : ''}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {isPending ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${isFood ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-blue-100 text-blue-700'}`}>
                            <Clock className="w-3 h-3" /> Arrived {formatDistanceToNow(new Date(delivery.receivedAt))} ago
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            <Clock className="w-3 h-3" /> {format(new Date(delivery.receivedAt), "MMM d, h:mm a")}
                          </span>
                        )}
                        
                        {!isPending && (
                          <span className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded ${
                            delivery.status === 'PICKED_UP' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                          }`}>
                            {delivery.status.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {showActions && isPending && (
                    <div className="mt-4 sm:mt-0">
                      <Button 
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => setSelectedDelivery(delivery)}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" /> Mark Picked Up
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            Deliveries
          </h1>
          <p className="text-gray-500">Track and collect your incoming packages</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full sm:w-64 h-12 mb-6">
          <TabsTrigger value="pending" className="relative h-10">
            Waiting Pickup
            {pendingData?.deliveries?.length > 0 && (
              <span className="ml-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {pendingData.deliveries.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="h-10">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending">
          {renderList(pendingData?.deliveries || [], pendingLoading, true)}
        </TabsContent>
        <TabsContent value="history">
          {renderList(historyData?.deliveries || [], historyLoading, false)}
        </TabsContent>
      </Tabs>

      {/* Pickup Dialog */}
      <Dialog open={!!selectedDelivery} onOpenChange={(open) => { if(!open) setSelectedDelivery(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delivery Pickup</DialogTitle>
            <DialogDescription>
              Enter the OTP sent to your phone to confirm you have picked up the {selectedDelivery?.category.toLowerCase()} delivery.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-2">
              {selectedDelivery && getCategoryIcon(selectedDelivery.category)}
            </div>
            
            <div className="space-y-2 w-full px-4">
              <Input 
                placeholder="Enter 6-digit OTP" 
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className="text-center tracking-widest text-lg font-mono"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSelectedDelivery(null)} className="flex-1">
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handlePickup}
              disabled={pickupMutation.isPending || !otp}
            >
              {pickupMutation.isPending ? "Confirming..." : "Confirm Pickup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
