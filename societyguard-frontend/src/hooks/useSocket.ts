"use client";

import { useEffect } from "react";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { useAuth } from "@/hooks/useAuth";

export function useSocketEvent(event: string, callback: (...args: any[]) => void) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Connect socket if not already connected
    connectSocket();
    
    const socket = getSocket();
    socket.on(event, callback);

    return () => {
      socket.off(event, callback);
    };
  }, [event, callback, user]);
}

export function useSocketConnection() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      connectSocket();
    } else {
      disconnectSocket();
    }
    
    return () => {
      // Keep it connected for the session, but disconnect on unmount of root provider if needed
    };
  }, [user]);
}
