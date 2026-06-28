"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "next-themes";
import {
  useSocketConnection,
  useVisitorNotifications,
  useDeliveryNotifications,
  useSOSNotifications,
  useStaffNotifications
} from "@/hooks/useSocket";

function RealTimeManager() {
  useSocketConnection();
  useVisitorNotifications();
  useDeliveryNotifications();
  useSOSNotifications();
  useStaffNotifications();
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
        <RealTimeManager />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
