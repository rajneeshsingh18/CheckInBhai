"use client";

import { useState } from "react";
import { useNotificationStore, NotificationItem } from "@/stores/useNotificationStore";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Bell,
  UserCheck,
  Package,
  AlertTriangle,
  Users,
  Settings,
  Volume2,
  VolumeX,
  CheckCheck,
  Trash2,
  Shield,
  Smartphone,
  MessageSquare,
  Mail,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sounds } from "@/lib/sounds";

export default function NotificationCenter() {
  const { notifications, preferences, markAsRead, markAllAsRead, clearAll, updatePreference } = useNotificationStore();
  const [activeTab, setActiveTab] = useState<"all" | "visitor" | "delivery" | "sos" | "staff">("all");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [prefOpen, setPrefOpen] = useState(false);

  // Mute Toggle (Sound Service uses localstorage)
  const [muted, setMuted] = useState(sounds.isMuted());
  const toggleMute = () => {
    const nextMuted = !muted;
    sounds.setMuted(nextMuted);
    setMuted(nextMuted);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasSOS = notifications.some((n) => n.type === "sos" && !n.read);

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "all") return true;
    return n.type === activeTab;
  });

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "visitor":
        return <UserCheck className="w-4 h-4 text-orange-600" />;
      case "delivery":
        return <Package className="w-4 h-4 text-indigo-600" />;
      case "sos":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case "staff":
        return <Users className="w-4 h-4 text-green-600" />;
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {/* Sound Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMute}
        className="text-gray-500 hover:text-gray-900 rounded-full"
        title={muted ? "Unmute sounds" : "Mute sounds"}
      >
        {muted ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5" />}
      </Button>

      {/* Notification Popover */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger className="relative p-2 text-gray-500 hover:text-orange-600 focus:outline-none rounded-full transition-colors">
          <Bell className={`w-6 h-6 ${hasSOS ? "text-red-500 animate-bounce" : ""}`} />
          {unreadCount > 0 && (
            <span className={`absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white ${hasSOS ? "animate-pulse" : ""}`}>
              {unreadCount}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-80 sm:w-96 p-0 bg-white border border-gray-200 shadow-xl rounded-xl z-50 mr-4">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
            <h4 className="font-bold text-gray-900">Notifications</h4>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="text-gray-500 hover:text-gray-800 rounded-full w-8 h-8"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearAll}
                disabled={notifications.length === 0}
                className="text-gray-500 hover:text-red-600 rounded-full w-8 h-8"
                title="Clear all"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setPopoverOpen(false);
                  setPrefOpen(true);
                }}
                className="text-gray-500 hover:text-gray-800 rounded-full w-8 h-8"
                title="Preferences"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 text-xs font-semibold px-2 bg-white">
            {(["all", "visitor", "delivery", "sos", "staff"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-center capitalize border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div className="max-h-[350px] overflow-y-auto divide-y divide-gray-100">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No notifications found.</div>
            ) : (
              filteredNotifications.map((n) => {
                const isSOS = n.type === "sos";
                return (
                  <div
                    key={n.id}
                    className={`p-4 transition-colors flex items-start space-x-3 cursor-pointer ${
                      !n.read ? "bg-orange-50/30" : "bg-white hover:bg-gray-50"
                    } ${isSOS ? "border-l-4 border-red-500 bg-red-50/20" : ""}`}
                    onClick={() => markAsRead(n.id)}
                  >
                    <div className={`p-2 rounded-lg flex-shrink-0 ${isSOS ? "bg-red-100" : "bg-gray-100"}`}>
                      {getIcon(n.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <span className={`text-sm font-bold truncate ${isSOS ? "text-red-700" : "text-gray-900"}`}>
                          {n.title}
                        </span>
                        {isSOS && (
                          <Badge variant="outline" className="bg-red-100 text-red-800 text-[9px] border-red-200 uppercase font-black tracking-widest shrink-0 px-1 py-0">
                            Emergency
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{n.description}</p>
                      
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="text-[10px] text-gray-400">
                          {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                        </span>
                        {n.actionLabel && (
                          <span className="text-[10px] font-bold text-orange-600 hover:text-orange-700 uppercase tracking-wider">
                            {n.actionLabel} &rarr;
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Preferences Dialog */}
      <Dialog open={prefOpen} onOpenChange={setPrefOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-gray-200 rounded-lg p-5">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-orange-600" /> Notification Preferences
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Delivery/Notification switches */}
            <div className="space-y-3.5 border-b border-gray-100 pb-4">
              <h5 className="text-sm font-bold text-gray-800 flex items-center">
                <Smartphone className="w-4 h-4 mr-1.5 text-gray-400" /> System Channels
              </h5>
              <div className="flex items-center justify-between">
                <Label htmlFor="pref-sound" className="text-sm font-medium text-gray-700">Audio Alerts (Chimes & Tones)</Label>
                <Switch
                  id="pref-sound"
                  checked={preferences.sound}
                  onCheckedChange={(val) => updatePreference("sound", val)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="pref-push" className="text-sm font-medium text-gray-700">Browser Push Notifications</Label>
                <Switch
                  id="pref-push"
                  checked={preferences.push}
                  onCheckedChange={(val) => updatePreference("push", val)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="pref-inapp" className="text-sm font-medium text-gray-700">In-App Notifications</Label>
                <Switch
                  id="pref-inapp"
                  checked={preferences.inApp}
                  onCheckedChange={(val) => updatePreference("inApp", val)}
                />
              </div>
            </div>

            {/* External channel switches */}
            <div className="space-y-3.5">
              <h5 className="text-sm font-bold text-gray-800 flex items-center">
                <MessageSquare className="w-4 h-4 mr-1.5 text-gray-400" /> Messaging Channels
              </h5>
              <div className="flex items-center justify-between">
                <Label htmlFor="pref-whatsapp" className="text-sm font-medium text-gray-700 flex items-center">
                  WhatsApp Messaging
                </Label>
                <Switch
                  id="pref-whatsapp"
                  checked={preferences.whatsapp}
                  onCheckedChange={(val) => updatePreference("whatsapp", val)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="pref-sms" className="text-sm font-medium text-gray-700 flex items-center">
                  SMS Gate Notifications
                </Label>
                <Switch
                  id="pref-sms"
                  checked={preferences.sms}
                  onCheckedChange={(val) => updatePreference("sms", val)}
                />
              </div>
            </div>
          </div>
          
          <div className="mt-5 flex justify-end">
            <Button onClick={() => setPrefOpen(false)} className="bg-orange-600 hover:bg-orange-700 text-white font-semibold">
              Save Preferences
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
