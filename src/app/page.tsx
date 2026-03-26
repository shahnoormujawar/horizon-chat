'use client';

import { useState, useEffect } from 'react';
import { useAuth, SignIn } from '@clerk/nextjs';
import { Sidebar } from '@/components/Sidebar';
import { ChatArea } from '@/components/ChatArea';
import { useChatStore } from '@/store/chat-store';

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (window.innerWidth >= 1024) setSidebarOpen(true);
  }, []);

  const hydrate = useChatStore(s => s.hydrate);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrate();
    setHydrated(true);
  }, [hydrate]);

  if (!mounted || !isLoaded || !hydrated) {
    // Return minimal shell for SSR, loading UI shows after mount
    if (!mounted) {
      return <div className="h-[100dvh] bg-bg-primary" />;
    }
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-8">
          <img src="/horizon-logo-with-text-dark.svg" alt="Horizon" className="w-[220px] sm:w-[280px]" />
          <div className="w-8 h-8 border-[2.5px] border-t-tertiary/30 border-t-accent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d4874e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              <h1 className="text-2xl font-semibold text-t-primary">horizon</h1>
            </div>
            <p className="text-t-tertiary text-sm">Sign in to get started</p>
          </div>
          <SignIn
            routing="hash"
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'bg-bg-secondary border border-b shadow-2xl',
              },
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex bg-bg-primary">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <ChatArea sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
    </div>
  );
}
