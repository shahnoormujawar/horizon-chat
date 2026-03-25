'use client';

import { useState, useEffect } from 'react';
import { useAuth, SignIn } from '@clerk/nextjs';
import { Sidebar } from '@/components/Sidebar';
import { ChatArea } from '@/components/ChatArea';
import { useChatStore } from '@/store/chat-store';

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Open sidebar by default on desktop
  useEffect(() => {
    if (window.innerWidth >= 1024) setSidebarOpen(true);
  }, []);
  const hydrate = useChatStore(s => s.hydrate);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrate();
    setHydrated(true);
  }, [hydrate]);

  if (!isLoaded || !hydrated) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d4874e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <div className="flex gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-t-tertiary animate-pulse-dot" />
            <div className="w-1.5 h-1.5 rounded-full bg-t-tertiary animate-pulse-dot [animation-delay:0.2s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-t-tertiary animate-pulse-dot [animation-delay:0.4s]" />
          </div>
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
