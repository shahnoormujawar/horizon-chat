# Horizon Chat

A premium AI chat application with an agentic, step-by-step interface inspired by top-tier AI tools like Manus. Built with Next.js, powered by Claude via OpenRouter, and designed to feel like a professional product — not a side project.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Claude](https://img.shields.io/badge/Claude-Sonnet-orange?logo=anthropic)
![ElevenLabs](https://img.shields.io/badge/ElevenLabs-Voice-black?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxyZWN0IHg9IjgiIHk9IjIiIHdpZHRoPSIzIiBoZWlnaHQ9IjIwIi8+PHJlY3QgeD0iMTMiIHk9IjIiIHdpZHRoPSIzIiBoZWlnaHQ9IjIwIi8+PC9zdmc+)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)

---

## What Makes Horizon Different

Most open-source chat UIs dump raw markdown on screen. Horizon gives you an **agentic experience** — the AI breaks complex tasks into visible phases, shows what it's researching, analyzing, and creating in real-time, and cites its sources. It looks and feels like a product you'd pay for.

---

## Features

### Agentic Task Interface
- AI responses are broken into **collapsible task groups** with named phases (Research, Analysis, Implementation, etc.)
- Each task shows **real-time sub-steps** as colored action pills — search (blue), analyze (purple), think (amber), create/edit/read (green)
- **Status indicators** per task group: spinning loader for active, green checkmark for complete, pending dot for queued
- Summary text between actions explains reasoning and findings
- Falls back to clean markdown for simple responses that don't need the full agent UI

### Source Citations
- When Claude references external knowledge, it cites sources with **clickable cards**
- Sources appear in a 2-column grid within each task group or globally at the bottom
- Cards show title, domain, and description with external link indicators
- Sources without URLs display a book icon for general knowledge references

### Voice Chat (ElevenLabs)
- **Voice input** — click the mic button to dictate messages with live waveform visualization and real-time transcript preview
- Recording UI replaces the input area with animated audio bars, elapsed timer, cancel (X) and confirm (checkmark) buttons
- Keyboard shortcuts: **Enter** to send, **Esc** to cancel while recording
- **Voice output** — hover any AI message to reveal a speaker icon; click to hear it read aloud via ElevenLabs TTS
- **Auto-voice mode** — toggle "Voice" in the header to automatically read every AI response out loud
- Loading spinner on the play button while TTS audio is being fetched, animated equalizer bar during playback
- Markdown, code blocks, and agent markers are stripped for clean, natural speech
- Browser's SpeechRecognition API handles speech-to-text (free, no extra API needed)
- ElevenLabs Turbo v2.5 model for fast, premium-quality voice synthesis
- Auto-restarts recognition if the browser silences it, so long dictations work seamlessly

### Buttery Smooth Streaming
- **Zero-flicker streaming** — tokens are buffered in a ref and rendered via `requestAnimationFrame`, not through React state on every token
- Store updates only happen on stream completion, preventing re-render storms
- Streaming cursor and thinking indicators provide visual feedback
- Agent steps animate in progressively as the response builds

### Smart Auto-Scroll
- Automatically scrolls to latest content during streaming using a rAF loop
- **Respects user intent** — if you scroll up to read earlier content, auto-scroll pauses
- Programmatic scroll detection guard prevents false "user scrolled" triggers
- Resumes auto-scroll when you scroll back to the bottom or on next message

### Multi-Session Chat Management
- Create, rename, and delete multiple chat sessions
- Chat history persists in localStorage across browser sessions
- Auto-titles chats based on the first user message
- Sidebar shows all tasks with quick navigation

### Authentication
- **Clerk authentication** with dark-themed sign-in flow
- User avatar in both sidebar and header
- Secure API route proxying — your OpenRouter key stays server-side

### Premium Dark UI
- Warm dark color palette with amber accents — not the generic gray-on-black look
- Manus-inspired layout: fixed sidebar, centered chat area, right-aligned user bubbles
- AI messages have a branded header with logo icon and "Claude" model badge
- Framer Motion animations throughout: message entrance, sidebar slide, task group expand/collapse
- Custom-styled scrollbars, selection color, and focus states
- Georgia serif heading on the empty state for a premium editorial feel

### Fully Mobile Responsive
- Adaptive layout from 320px phones to ultrawide monitors
- Sidebar overlays on mobile with backdrop tap-to-close, slides in from the left
- Sidebar starts closed on mobile, open on desktop
- `100dvh` viewport height handles mobile browser address bars correctly
- Header hides secondary actions (Share, Upgrade, Bell) on small screens
- Input toolbar collapses to essential icons (Plus, Mic, Send) on mobile
- Agent step pills, code blocks, and markdown all wrap and scale for small screens
- Touch-friendly hit targets throughout

### Developer Experience
- Clean component architecture: `ChatArea`, `Sidebar`, `MessageBubble`, `StreamingMessage`, `AgentSteps`, `MessageInput`, `CodeBlock`
- Zustand for state management with a simple, flat store
- Custom parser (`parse-agent-steps.ts`) converts structured AI output markers into typed data
- Streaming handled via SSE with status transitions (understanding → planning → generating → completed)
- TypeScript throughout with strict types for messages, agent status, parsed content

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Auth | Clerk (@clerk/nextjs v7) |
| State | Zustand 5 |
| AI | Claude via OpenRouter API |
| Voice | ElevenLabs TTS + Web Speech API |
| Animations | Framer Motion 12 |
| Markdown | react-markdown + remark-gfm |
| Icons | Lucide React |

---

## Getting Started

### Prerequisites

- Node.js 18+
- An [OpenRouter](https://openrouter.ai) API key
- An [ElevenLabs](https://elevenlabs.io) API key (for voice chat)
- A [Clerk](https://clerk.com) application (free tier works)

### Setup

1. **Clone and install**
   ```bash
   git clone <repo-url>
   cd horizon-chat
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your keys:
   ```env
   OPENROUTER_API_KEY=sk-or-...
   OPENROUTER_MODEL=anthropic/claude-sonnet-4  # or any model on OpenRouter
   ELEVENLABS_API_KEY=sk_...                   # for voice chat
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...
   ```

3. **Run**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
src/
├── app/
│   ├── api/chat/route.ts      # OpenRouter proxy with system prompt
│   ├── api/voice/tts/route.ts # ElevenLabs TTS streaming endpoint
│   ├── globals.css             # Theme, prose styles, scrollbar
│   ├── layout.tsx              # Clerk provider, viewport config
│   └── page.tsx                # Auth gate, hydration, layout shell
├── components/
│   ├── AgentSteps.tsx          # Collapsible task groups + source cards
│   ├── ChatArea.tsx            # Main chat view, streaming, auto-scroll
│   ├── CodeBlock.tsx           # Syntax block with copy button
│   ├── MessageBubble.tsx       # User/AI message rendering
│   ├── MessageInput.tsx        # Textarea with icon toolbar
│   ├── Sidebar.tsx             # Chat list, nav, mobile overlay
│   ├── StatusIndicator.tsx     # Streaming status pill
│   └── StreamingMessage.tsx    # rAF-based live rendering
├── hooks/
│   ├── useVoiceRecorder.ts    # Speech recognition + audio visualizer
│   └── useVoicePlayback.ts    # ElevenLabs TTS playback management
├── lib/
│   ├── parse-agent-steps.ts    # Structured response parser
│   ├── streaming.ts            # SSE stream reader + status transitions
│   ├── storage.ts              # localStorage persistence
│   ├── types.ts                # Message, Chat, AgentStatus types
│   └── utils.ts                # ID generation, date formatting
└── store/
    └── chat-store.ts           # Zustand store for all chat state
```

---

## How the Agentic UI Works

The system prompt instructs Claude to structure complex responses using markers:

```
[TASK: Research current approaches]
[SEARCH] Looking up latest documentation...
[ANALYZE] Comparing options based on requirements...

Summary text explaining findings.

[SOURCE: React Docs | https://react.dev | Official documentation]
[/TASK]
```

The `parse-agent-steps.ts` parser converts these markers into typed data structures that render as the collapsible task group UI. During streaming, the parser runs on every frame to progressively build the interface. Simple responses without markers render as standard markdown.

---

## License

MIT
