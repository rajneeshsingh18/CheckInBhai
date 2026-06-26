"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { QrCode, Plus, Share2, Copy, Trash2, Calendar, CheckCircle } from "lucide-react";

const passSchema = z.object({
  visitorName: z.string().min(2, "Name is required"),
  visitorMobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid mobile number").optional().or(z.literal('')),
  purpose: z.string().min(2, "Purpose is required"),
  validTill: z.string().min(1, "Valid till is required"),
  notes: z.string().optional(),
});

type PassFormValues = z.infer<typeof passSchema>;

export default function CreateGuestPass() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState<any>(null);

  const { data: passesData, isLoading } = useQuery({
    queryKey: ['guestPasses'],
    queryFn: async () => {
      const res = await api.get('/guest-passes');
      return res.data.data;
    }
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<PassFormValues>({
    resolver: zodResolver(passSchema),
  });

  const createPassMutation = useMutation({
    mutationFn: async (data: PassFormValues) => {
      // Convert validTill to ISO string adding 23:59:59 to the end of the day
      const date = new Date(data.validTill);
      date.setHours(23, 59, 59);
      
      const payload = {
        visitorName: data.visitorName,
        visitorMobile: data.visitorMobile || undefined,
        purpose: data.purpose,
        validFrom: new Date().toISOString(),
        validTill: date.toISOString(),
        notes: data.notes
      };
      
      const res = await api.post('/guest-passes', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success("Guest pass generated successfully");
      queryClient.invalidateQueries({ queryKey: ['guestPasses'] });
      setIsCreateModalOpen(false);
      reset();
      // Auto-open the newly created pass to show QR
      if (data?.data?.pass) {
        setSelectedPass(data.data.pass);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to generate pass");
    }
  });

  const cancelPassMutation = useMutation({
    mutationFn: async (passId: string) => {
      const res = await api.post(`/guest-passes/${passId}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Pass cancelled");
      queryClient.invalidateQueries({ queryKey: ['guestPasses'] });
      setSelectedPass(null);
    }
  });

  const onSubmit = (data: PassFormValues) => {
    createPassMutation.mutate(data);
  };

  const handleShare = async (pass: any) => {
    const text = `Guest Pass for ${pass.visitorName}\nValid till: ${format(new Date(pass.validTill), "MMM d, yyyy")}\nPresent this QR code at the gate.`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Guest Pass',
          text: text,
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Pass details copied to clipboard");
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <QrCode className="w-6 h-6 text-orange-600" />
            Guest Passes
          </h1>
          <p className="text-gray-500">Create pre-approved entry passes for your guests</p>
        </div>
        <Button 
          className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" /> New Pass
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>)}
        </div>
      ) : passesData?.entries?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {passesData.entries.map((pass: any) => {
            const isActive = pass.status === 'ACTIVE' && new Date(pass.validTill) > new Date();
            return (
              <Card 
                key={pass.id} 
                className={`overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${isActive ? 'border-green-200' : 'border-gray-200 bg-gray-50 opacity-75'}`}
                onClick={() => setSelectedPass(pass)}
              >
                <CardContent className="p-0 flex h-32">
                  <div className={`w-32 flex-shrink-0 flex items-center justify-center border-r ${isActive ? 'bg-green-50 border-green-100' : 'bg-gray-100 border-gray-200'}`}>
                    <QRCodeSVG 
                      value={pass.qrToken} 
                      size={80} 
                      level="H" 
                      fgColor={isActive ? "#000000" : "#6b7280"}
                    />
                  </div>
                  <div className="p-4 flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className="font-bold text-gray-900 truncate">{pass.visitorName}</h3>
                    <p className="text-sm text-gray-500 truncate">{pass.purpose}</p>
                    <div className="mt-auto">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                        {isActive ? 'ACTIVE' : pass.status}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No active passes</h3>
          <p className="text-gray-500 max-w-sm mx-auto mt-1 mb-4">Create a guest pass to instantly allow visitors through the gate without requiring approval.</p>
          <Button variant="outline" onClick={() => setIsCreateModalOpen(true)}>Create Pass</Button>
        </div>
      )}

      {/* Create Pass Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Guest Pass</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Visitor Name *</label>
              <Input {...register("visitorName")} placeholder="John Doe" />
              {errors.visitorName && <p className="text-xs text-red-500">{errors.visitorName.message}</p>}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Mobile Number (Optional)</label>
              <Input {...register("visitorMobile")} placeholder="9876543210" maxLength={10} />
              {errors.visitorMobile && <p className="text-xs text-red-500">{errors.visitorMobile.message}</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Purpose *</label>
                <Input {...register("purpose")} placeholder="Meeting / Dinner" />
                {errors.purpose && <p className="text-xs text-red-500">{errors.purpose.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Valid Till Date *</label>
                <Input type="date" {...register("validTill")} min={new Date().toISOString().split('T')[0]} />
                {errors.validTill && <p className="text-xs text-red-500">{errors.validTill.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Notes (Optional)</label>
              <Input {...register("notes")} placeholder="Any specific instructions for guard" />
            </div>

            <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={createPassMutation.isPending}>
              {createPassMutation.isPending ? "Generating..." : "Generate QR Pass"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Pass Modal */}
      <Dialog open={!!selectedPass} onOpenChange={(open) => !open && setSelectedPass(null)}>
        <DialogContent className="sm:max-w-sm flex flex-col items-center text-center p-8">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <DialogTitle className="text-2xl font-bold mb-1">{selectedPass?.visitorName}</DialogTitle>
          <p className="text-sm text-gray-500 mb-6">{selectedPass?.purpose}</p>

          <div className="bg-white p-4 rounded-xl border-2 border-gray-100 shadow-sm mb-6 inline-block">
            <QRCodeSVG 
              value={selectedPass?.qrToken || ""} 
              size={200} 
              level="H" 
              includeMargin={true}
            />
          </div>

          <div className="w-full bg-gray-50 rounded-lg p-4 mb-6 text-sm text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Valid Till:</span>
              <span className="font-medium text-gray-900">{selectedPass && format(new Date(selectedPass.validTill), "MMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status:</span>
              <span className={`font-bold ${selectedPass?.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>
                {selectedPass?.status}
              </span>
            </div>
            {selectedPass?.notes && (
              <div className="pt-2 mt-2 border-t border-gray-200">
                <span className="text-gray-500 block text-xs">Notes:</span>
                <span className="text-gray-900">{selectedPass.notes}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 w-full">
            <Button className="flex-1" variant="outline" onClick={() => handleShare(selectedPass)}>
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
            {selectedPass?.status === 'ACTIVE' && (
              <Button 
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" 
                variant="outline"
                onClick={() => cancelPassMutation.mutate(selectedPass.id)}
                disabled={cancelPassMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Cancel
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
