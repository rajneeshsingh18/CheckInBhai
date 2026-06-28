"use client";

import { create } from "zustand";

export interface NotificationItem {
  id: string;
  type: "visitor" | "delivery" | "sos" | "staff";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: any;
}

interface NotificationPreferences {
  sound: boolean;
  push: boolean;
  inApp: boolean;
  whatsapp: boolean;
  sms: boolean;
}

interface NotificationStore {
  notifications: NotificationItem[];
  preferences: NotificationPreferences;
  addNotification: (item: Omit<NotificationItem, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  updatePreference: (key: keyof NotificationPreferences, value: boolean) => void;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  sound: true,
  push: true,
  inApp: true,
  whatsapp: false,
  sms: true,
};

export const useNotificationStore = create<NotificationStore>((set, get) => {
  // Load initial notifications and preferences from local storage if available
  const getInitialState = () => {
    if (typeof window === "undefined") return { notifications: [], preferences: DEFAULT_PREFERENCES };
    try {
      const storedNotes = localStorage.getItem("rakshak_notifications");
      const storedPrefs = localStorage.getItem("rakshak_preferences");
      return {
        notifications: storedNotes ? JSON.parse(storedNotes) : [],
        preferences: storedPrefs ? JSON.parse(storedPrefs) : DEFAULT_PREFERENCES,
      };
    } catch {
      return { notifications: [], preferences: DEFAULT_PREFERENCES };
    }
  };

  const initialState = getInitialState();

  return {
    notifications: initialState.notifications,
    preferences: initialState.preferences,

    addNotification: (item) => {
      const newNote: NotificationItem = {
        ...item,
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        read: false,
      };
      
      const updatedNotes = [newNote, ...get().notifications];
      set({ notifications: updatedNotes });
      if (typeof window !== "undefined") {
        localStorage.setItem("rakshak_notifications", JSON.stringify(updatedNotes));
      }
    },

    markAsRead: (id) => {
      const updatedNotes = get().notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      set({ notifications: updatedNotes });
      if (typeof window !== "undefined") {
        localStorage.setItem("rakshak_notifications", JSON.stringify(updatedNotes));
      }
    },

    markAllAsRead: () => {
      const updatedNotes = get().notifications.map((n) => ({ ...n, read: true }));
      set({ notifications: updatedNotes });
      if (typeof window !== "undefined") {
        localStorage.setItem("rakshak_notifications", JSON.stringify(updatedNotes));
      }
    },

    clearAll: () => {
      set({ notifications: [] });
      if (typeof window !== "undefined") {
        localStorage.setItem("rakshak_notifications", JSON.stringify([]));
      }
    },

    updatePreference: (key, value) => {
      const updatedPrefs = { ...get().preferences, [key]: value };
      set({ preferences: updatedPrefs });
      if (typeof window !== "undefined") {
        localStorage.setItem("rakshak_preferences", JSON.stringify(updatedPrefs));
      }
    },
  };
});
