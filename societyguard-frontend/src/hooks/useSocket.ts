"use client";

import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSocket, connectSocket, disconnectSocket } from "@/lib/socket";
import { useAuth } from "@/hooks/useAuth";
import { sounds } from "@/lib/sounds";
import { useNotificationStore } from "@/stores/useNotificationStore";

/**
 * Custom Hook: useSocket
 * Subscribes to a socket event, handles auto-cleanup on unmount,
 * and handles re-subscribing on reconnection.
 */
export function useSocket(event: string, callback: (...args: any[]) => void) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    connectSocket();
    const socket = getSocket();

    socket.on(event, callback);

    const handleReconnect = () => {
      console.log(`[Socket.io] Reconnected. Binding event: ${event}`);
      socket.off(event, callback);
      socket.on(event, callback);
    };

    socket.on("connect", handleReconnect);
    socket.on("reconnect", handleReconnect);

    return () => {
      socket.off(event, callback);
      socket.off("connect", handleReconnect);
      socket.off("reconnect", handleReconnect);
    };
  }, [event, callback, user]);
}

export const useSocketEvent = useSocket;

/**
 * Connection Status and Initialization Hook
 */
export function useSocketConnection() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      connectSocket();
    } else {
      disconnectSocket();
    }
  }, [user]);
}

/**
 * Hook to handle real-time Visitor Notifications
 */
export function useVisitorNotifications() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((s) => s.addNotification);

  const handleNewEntry = useCallback((data: any) => {
    console.log("[Socket.io] New visitor entry:", data);
    sounds.playVisitorSound();
    
    const label = data.visitor?.name || "Visitor";
    const flatNo = data.entry?.flat?.number || "";
    
    toast.info(`New Visitor: ${label} at the gate. Action required!`, {
      duration: 8000,
    });
    
    addNotification({
      type: "visitor",
      title: "New Visitor at Gate",
      description: `${label} is waiting for entry approval to Flat ${flatNo}.`,
      actionLabel: "Approve/Reject",
      metadata: { entryId: data.entry?.id }
    });
    
    // Invalidate TanStack Query caches
    queryClient.invalidateQueries({ queryKey: ["visitor-entries"] });
    queryClient.invalidateQueries({ queryKey: ["visitors"] });
    queryClient.invalidateQueries({ queryKey: ["pending-count"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, addNotification]);

  const handleApproved = useCallback((data: any) => {
    console.log("[Socket.io] Visitor approved:", data);
    
    toast.success(`Visitor Approved: ${data.visitorName || "Guest"} allowed to enter flat ${data.flatNumber}.`);
    
    addNotification({
      type: "visitor",
      title: "Visitor Approved",
      description: `Visitor ${data.visitorName || "Guest"} has been approved to enter flat ${data.flatNumber}.`,
      metadata: { entryId: data.entryId }
    });

    queryClient.invalidateQueries({ queryKey: ["visitor-entries"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, addNotification]);

  const handleRejected = useCallback((data: any) => {
    console.log("[Socket.io] Visitor rejected:", data);
    
    toast.error(`Visitor Rejected: ${data.visitorName || "Guest"} turned away. Reason: ${data.reason || "None"}`);
    
    addNotification({
      type: "visitor",
      title: "Visitor Rejected",
      description: `Visitor ${data.visitorName || "Guest"} was rejected. Reason: ${data.reason || "None"}.`,
      metadata: { entryId: data.entryId }
    });

    queryClient.invalidateQueries({ queryKey: ["visitor-entries"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, addNotification]);

  const handleExited = useCallback((data: any) => {
    console.log("[Socket.io] Visitor exited:", data);
    toast.info(`Visitor Exited: ${data.visitorName || "Guest"} has logged exit.`);
    
    addNotification({
      type: "visitor",
      title: "Visitor Exited",
      description: `Visitor ${data.visitorName || "Guest"} has left the society premises.`,
      metadata: { entryId: data.entryId }
    });

    queryClient.invalidateQueries({ queryKey: ["visitor-entries"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, addNotification]);

  const handleGuestArrived = useCallback((data: any) => {
    console.log("[Socket.io] Guest arrived with pass:", data);
    sounds.playVisitorSound();
    
    toast.success(`Guest Pass Scan: ${data.guestName || "Guest"} has checked in at the gate.`);
    
    addNotification({
      type: "visitor",
      title: "Guest Pass Checked In",
      description: `Pre-approved guest ${data.guestName || "Guest"} has checked in at the gate.`,
    });

    queryClient.invalidateQueries({ queryKey: ["visitor-entries"] });
    queryClient.invalidateQueries({ queryKey: ["guest-passes"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, addNotification]);

  useSocket("visitor:new-entry", handleNewEntry);
  useSocket("visitor:approved", handleApproved);
  useSocket("visitor:rejected", handleRejected);
  useSocket("visitor:exited", handleExited);
  useSocket("guest:arrived", handleGuestArrived);
}

/**
 * Hook to handle real-time Delivery Notifications
 */
export function useDeliveryNotifications() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((s) => s.addNotification);

  const handleDeliveryReceived = useCallback((data: any) => {
    console.log("[Socket.io] Delivery received:", data);
    sounds.playDeliverySound();
    
    const cat = data.delivery?.category || "Courier";
    
    toast.info(`Delivery Logged: Package from ${cat} received at the guard room.`, {
      duration: 6000,
    });

    addNotification({
      type: "delivery",
      title: "New Delivery Logged",
      description: `Package from ${cat} received. Collect from the guard gate.`,
      actionLabel: "Collect Package",
      metadata: { deliveryId: data.delivery?.id }
    });

    queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    queryClient.invalidateQueries({ queryKey: ["delivery-stats"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, addNotification]);

  const handleDeliveryPickedUp = useCallback((data: any) => {
    console.log("[Socket.io] Delivery picked up:", data);
    toast.success(`Delivery Picked Up: Package has been collected.`);

    addNotification({
      type: "delivery",
      title: "Delivery Collected",
      description: `Package has been picked up from guard room.`,
      metadata: { deliveryId: data.deliveryId }
    });

    queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, addNotification]);

  const handleDeliveryReturned = useCallback((data: any) => {
    console.log("[Socket.io] Delivery marked returned:", data);
    toast.warning(`Delivery Returned: Package was returned.`);

    addNotification({
      type: "delivery",
      title: "Delivery Returned",
      description: `Package was marked as returned to courier.`,
      metadata: { deliveryId: data.deliveryId }
    });

    queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, addNotification]);

  useSocket("delivery:received", handleDeliveryReceived);
  useSocket("delivery:picked-up", handleDeliveryPickedUp);
  useSocket("delivery:returned", handleDeliveryReturned);
}

/**
 * Hook to handle real-time SOS Notifications
 */
export function useSOSNotifications() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((s) => s.addNotification);

  const handleSOSRaised = useCallback((data: any) => {
    console.log("[Socket.io] SOS Alert Raised!", data);
    sounds.playSOSSound();
    
    toast.error(`🚨 EMERGENCY SOS ACTIVE! ${data.alert?.raisedBy || "Someone"} raised SOS from ${data.alert?.location || "Unknown"}!`, {
      duration: 15000,
    });

    addNotification({
      type: "sos",
      title: "🚨 SOS ALERT ACTIVE",
      description: `Emergency raised by ${data.alert?.raisedBy || "Resident"} at flat location ${data.alert?.location || "N/A"}.`,
      actionLabel: "View Alert",
      metadata: { alertId: data.alert?.id }
    });

    queryClient.invalidateQueries({ queryKey: ["sos-alerts"] });
    queryClient.invalidateQueries({ queryKey: ["active-alerts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, addNotification]);

  const handleSOSAcknowledged = useCallback((data: any) => {
    console.log("[Socket.io] SOS Alert Acknowledged", data);
    toast.success(`SOS Acknowledged: Alert is being resolved by ${data.acknowledgedBy || "Security"}.`);

    addNotification({
      type: "sos",
      title: "SOS Acknowledged",
      description: `Emergency alert is acknowledged and being handled by ${data.acknowledgedBy || "Security"}.`,
      metadata: { alertId: data.alertId }
    });

    queryClient.invalidateQueries({ queryKey: ["sos-alerts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, addNotification]);

  const handleSOSResolved = useCallback((data: any) => {
    console.log("[Socket.io] SOS Alert Resolved", data);
    toast.info(`SOS Alert Resolved: Emergency status cleared.`);

    addNotification({
      type: "sos",
      title: "SOS Resolved",
      description: `Emergency alert has been resolved and closed.`,
      metadata: { alertId: data.alertId }
    });

    queryClient.invalidateQueries({ queryKey: ["sos-alerts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, addNotification]);

  useSocket("sos:raised", handleSOSRaised);
  useSocket("sos:acknowledged", handleSOSAcknowledged);
  useSocket("sos:resolved", handleSOSResolved);
}

/**
 * Hook to handle real-time Staff Status Notifications
 */
export function useStaffNotifications() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((s) => s.addNotification);

  const handleStaffCheckIn = useCallback((data: any) => {
    console.log("[Socket.io] Staff checked in:", data);
    toast.info(`Staff Check-in: ${data.staffName || "Staff member"} has arrived.`);

    addNotification({
      type: "staff",
      title: "Staff Checked In",
      description: `${data.staffName || "Staff member"} checked in to flat ${data.flatNumber || ""}.`,
      actionLabel: "View Staff"
    });

    queryClient.invalidateQueries({ queryKey: ["staff"] });
    queryClient.invalidateQueries({ queryKey: ["staff-attendance"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, addNotification]);

  const handleStaffCheckOut = useCallback((data: any) => {
    console.log("[Socket.io] Staff checked out:", data);
    toast.info(`Staff Check-out: ${data.staffName || "Staff member"} has left.`);

    addNotification({
      type: "staff",
      title: "Staff Checked Out",
      description: `${data.staffName || "Staff member"} checked out.`,
      actionLabel: "View Staff"
    });

    queryClient.invalidateQueries({ queryKey: ["staff"] });
    queryClient.invalidateQueries({ queryKey: ["staff-attendance"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, addNotification]);

  useSocket("staff:check-in", handleStaffCheckIn);
  useSocket("staff:check-out", handleStaffCheckOut);
}
