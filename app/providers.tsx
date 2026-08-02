"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { PwaProvider } from "@/components/app/PwaProvider";
import { Toaster } from "@/components/ui/sonner";

export function Providers({
  children,
  nonce,
}: {
  children: React.ReactNode;
  nonce?: string;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
        nonce={nonce}
      >
        <PwaProvider>{children}</PwaProvider>
        <Toaster position="top-center" richColors closeButton duration={3000} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
