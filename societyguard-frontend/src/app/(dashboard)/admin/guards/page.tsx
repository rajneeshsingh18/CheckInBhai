"use client";

import { useState } from "react";
import {
  useAdminGuards,
  useCreateGuard,
  useUpdateGuard,
  useResetGuardPin,
  useGuardActivityLog
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Edit2,
  Trash2,
  KeyRound,
  History,
  Shield,
  Smartphone,
  Mail,
  Clock,
  UserCheck,
  Package,
  Users,
  Eye,
  Lock
} from "lucide-react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { format } from "date-fns";
import { toast } from "sonner";

export default function GuardManagement() {
  const { data: guards = [], isLoading, refetch } = useAdminGuards();

  // Mutations
  const createGuard = useCreateGuard();
  const updateGuard = useUpdateGuard();
  const resetPin = useResetGuardPin();

  // Dialog States
  const [guardModalOpen, setGuardModalOpen] = useState(false);
  const [editingGuard, setEditingGuard] = useState<any>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [password, setPassword] = useState("");

  // Pin Reveal State
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);

  // Activity Log State
  const [activeLogGuardId, setActiveLogGuardId] = useState<string | null>(null);
  const [activeLogGuardName, setActiveLogGuardName] = useState("");
  const [logOpen, setLogOpen] = useState(false);

  // Retrieve logs for the active guard
  const { data: activityLogs = [], isLoading: logLoading } = useGuardActivityLog(activeLogGuardId || "");

  const handleGuardSubmit = async () => {
    if (!name.trim() || !email.trim() || !mobile.trim()) {
      toast.error("Name, email, and mobile are required");
      return;
    }

    // Convert shift times into Date objects or formatted string
    // In our backend admin routes, we parser shiftStart/shiftEnd as Date
    // E.g., we can construct today's date with the specified hours
    const today = new Date().toISOString().split("T")[0];
    const shiftStartISO = shiftStart ? new Date(`${today}T${shiftStart}:00`).toISOString() : undefined;
    const shiftEndISO = shiftEnd ? new Date(`${today}T${shiftEnd}:00`).toISOString() : undefined;

    if (editingGuard) {
      await updateGuard.mutateAsync({
        id: editingGuard.id,
        guardData: {
          name,
          email,
          mobile,
          shiftStart: shiftStartISO,
          shiftEnd: shiftEndISO,
          isActive: editingGuard.isActive // preserve or let toggle handle it
        }
      });
    } else {
      const res = await createGuard.mutateAsync({
        name,
        email,
        mobile,
        shiftStart: shiftStartISO,
        shiftEnd: shiftEndISO,
        password: password || undefined
      });
      
      // Reveal the generated PIN code
      if (res && res.data && res.data.pin) {
        setRevealedPin(res.data.pin);
        setPinOpen(true);
      }
    }

    setGuardModalOpen(false);
    clearForm();
    refetch();
  };

  const handleToggleStatus = async (guard: any, activeVal: boolean) => {
    await updateGuard.mutateAsync({
      id: guard.id,
      guardData: {
        name: guard.name,
        email: guard.email,
        mobile: guard.mobile,
        isActive: activeVal
      }
    });
    refetch();
  };

  const handleResetPin = async (id: string) => {
    const res = await resetPin.mutateAsync(id);
    if (res && res.pin) {
      setRevealedPin(res.pin);
      setPinOpen(true);
    }
  };

  const openActivityLog = (guard: any) => {
    setActiveLogGuardId(guard.id);
    setActiveLogGuardName(guard.name);
    setLogOpen(true);
  };

  const clearForm = () => {
    setName("");
    setEmail("");
    setMobile("");
    setShiftStart("");
    setShiftEnd("");
    setPassword("");
    setEditingGuard(null);
  };

  const formatTimeStr = (isoString?: string) => {
    if (!isoString) return "Not set";
    try {
      return format(new Date(isoString), "hh:mm a");
    } catch {
      return "Not set";
    }
  };

  const getIsoTimeInputVal = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    } catch {
      return "";
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Guards & Shift Patrols</h1>
          <p className="text-gray-500 mt-1">Manage security guard credentials, PIN generation, and shifts.</p>
        </div>
        <Button
          onClick={() => {
            clearForm();
            setGuardModalOpen(true);
          }}
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Guard
        </Button>
      </div>

      {/* Roster Listing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-16 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-orange-600 border-t-transparent animate-spin" />
          </div>
        ) : guards.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm">No guards registered in this society yet.</p>
          </div>
        ) : (
          guards.map((guard: any) => (
            <Card key={guard.id} className="overflow-hidden hover:shadow-md transition-all border border-gray-200 bg-white flex flex-col justify-between">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-orange-50 border border-orange-100 rounded-xl text-orange-600">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">{guard.name}</h4>
                      <div className="flex space-x-1.5 mt-1 items-center">
                        {guard.isOnDuty ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">On Duty</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-500 text-[10px]">Off Duty</Badge>
                        )}
                        {guard.isActive ? (
                          <Badge variant="outline" className="text-[10px] bg-green-50/50 text-green-700 border-green-200">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-red-50/50 text-red-700 border-red-200">Suspended</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Status Toggle switch */}
                  <Switch
                    checked={guard.isActive}
                    onCheckedChange={(val) => handleToggleStatus(guard, val)}
                    title={guard.isActive ? "Deactivate Guard" : "Activate Guard"}
                  />
                </div>

                <div className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-3">
                  <div className="flex items-center">
                    <Smartphone className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                    <span>{guard.mobile}</span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                    <span className="truncate">{guard.email}</span>
                  </div>
                  <div className="flex items-center bg-gray-50 p-2.5 rounded-lg border border-gray-150 text-xs">
                    <Clock className="w-4 h-4 mr-2 text-orange-500 shrink-0" />
                    <span className="font-semibold text-gray-800">
                      Shift: {formatTimeStr(guard.shiftStart)} - {formatTimeStr(guard.shiftEnd)}
                    </span>
                  </div>
                </div>
              </CardContent>

              {/* Card Footer Actions */}
              <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex items-center justify-between">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => openActivityLog(guard)}
                  className="text-xs font-semibold text-gray-700 border-gray-300 bg-white"
                >
                  <History className="w-3.5 h-3.5 mr-1" /> Activity Log
                </Button>
                <div className="flex space-x-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingGuard(guard);
                      setName(guard.name);
                      setEmail(guard.email);
                      setMobile(guard.mobile);
                      setShiftStart(getIsoTimeInputVal(guard.shiftStart));
                      setShiftEnd(getIsoTimeInputVal(guard.shiftEnd));
                      setGuardModalOpen(true);
                    }}
                    className="w-8 h-8 rounded-full text-gray-500 hover:bg-gray-200"
                    title="Edit shift details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleResetPin(guard.id)}
                    className="w-8 h-8 rounded-full text-orange-600 hover:bg-orange-100"
                    title="Reset PIN"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={guardModalOpen} onOpenChange={setGuardModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-gray-200 p-5 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              {editingGuard ? "Update Guard & Shifts" : "Register Security Guard"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label htmlFor="g-name">Guard Name</Label>
              <Input
                id="g-name"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="g-email">Email Address</Label>
              <Input
                id="g-email"
                type="email"
                placeholder="guard@society.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="g-mobile">Mobile Number</Label>
              <Input
                id="g-mobile"
                placeholder="Mobile number with country code"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="g-start">Shift Start</Label>
                <Input
                  id="g-start"
                  type="time"
                  value={shiftStart}
                  onChange={(e) => setShiftStart(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="g-end">Shift End</Label>
                <Input
                  id="g-end"
                  type="time"
                  value={shiftEnd}
                  onChange={(e) => setShiftEnd(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {!editingGuard && (
              <div>
                <Label htmlFor="g-password">Guard Console Password (Optional)</Label>
                <Input
                  id="g-password"
                  type="password"
                  placeholder="Set login password, default: Guard@1234"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGuardModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGuardSubmit}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
              Save Guard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN Reveal Modal */}
      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent className="sm:max-w-sm bg-white border border-gray-200 p-5 rounded-lg text-center">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 mx-auto">Security PIN Generated</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="p-3 bg-orange-100 rounded-full text-orange-600 w-12 h-12 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6 animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold block">Guard PIN Code</span>
              <span className="text-4xl font-black text-orange-600 tracking-widest bg-orange-50 px-5 py-2.5 rounded-xl border-2 border-orange-100 inline-block my-2">
                {revealedPin}
              </span>
            </div>

            <p className="text-xs text-gray-500 max-w-[260px] mx-auto leading-relaxed">
              Share this PIN code with the guard. They will use this PIN along with their User ID to log in on the gate console.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setPinOpen(false)} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guard Activity Log Drawer/Modal */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="sm:max-w-lg bg-white border border-gray-200 p-5 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              Activity Logs: {activeLogGuardName}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[380px] overflow-y-auto py-3 space-y-3 divide-y divide-gray-100">
            {logLoading ? (
              <div className="py-12 flex justify-center text-sm text-gray-400">Loading activity...</div>
            ) : activityLogs.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400 italic">No activity logged today.</div>
            ) : (
              activityLogs.map((log: any, idx: number) => {
                const getLogIcon = (type: string) => {
                  switch (type) {
                    case "VISITOR_ENTRY":
                      return <UserCheck className="w-4 h-4 text-orange-600" />;
                    case "DELIVERY":
                      return <Package className="w-4 h-4 text-indigo-600" />;
                    case "STAFF_ATTENDANCE":
                      return <Users className="w-4 h-4 text-green-600" />;
                    default:
                      return <Shield className="w-4 h-4 text-gray-500" />;
                  }
                };

                return (
                  <div key={log.id || idx} className="flex items-start space-x-3 pt-3.5 first:pt-0">
                    <div className="p-2 bg-gray-50 border border-gray-100 rounded-lg shrink-0 mt-0.5">
                      {getLogIcon(log.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                        {log.type.replace(/_/g, " ")}
                      </p>
                      <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{log.description}</p>
                      <span className="text-[10px] text-gray-400 mt-1.5 block">
                        {format(new Date(log.timestamp), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="border-t border-gray-100 pt-3">
            <Button onClick={() => setLogOpen(false)} className="bg-orange-600 hover:bg-orange-700 text-white font-semibold">
              Close Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
