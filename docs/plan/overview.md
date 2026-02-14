# Architecture Overview

## System Architecture

ProSys is a self-hosted family productivity app running entirely on the local network. One device acts as the **host** (macOS via Tauri v2), running both the web server and database. All other devices (phones, tablets, other Macs) connect via browser or PWA.

```
┌─────────────────────────────────────────────────┐
│  Host (Mac)                                     │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Tauri v2  │  │ SvelteKit│  │   SQLite     │ │
│  │ (desktop  │──│ Server   │──│   Database   │ │
│  │  shell)   │  │ (Node)   │  │              │ │
│  └───────────┘  └────┬─────┘  └──────────────┘ │
│                      │ HTTP + WebSocket          │
│                      │ mDNS broadcast            │
└──────────────────────┼──────────────────────────┘
                       │ LAN
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
   │ iPhone  │   │  iPad   │   │  Mac 2  │
   │  (PWA)  │   │ (Safari)│   │(browser)│
   └─────────┘   └─────────┘   └─────────┘
```

## Technology Decisions

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend** | SvelteKit + Svelte 5 | Already proven in prototype; runes for reactivity; SSR for initial load |
| **Styling** | Tailwind CSS v4 | Already in prototype; utility-first; v4 for modern features |
| **Backend** | SvelteKit API routes | Same framework for front and back; simple deployment |
| **Database** | SQLite via better-sqlite3 | Single-file DB, zero config, perfect for local-first |
| **ORM** | Drizzle ORM | Type-safe queries, lightweight, great SQLite support |
| **Real-time** | WebSocket (ws library) | Native Node.js; SvelteKit server hooks for upgrade |
| **Desktop** | Tauri v2 | Lightweight macOS shell; spawns the SvelteKit server |
| **Mobile** | PWA (Safari) | No app store needed; works on iOS/iPadOS |
| **Discovery** | bonjour-service (mDNS) | Devices find the host without typing IPs |
| **Drag & Drop** | svelte-dnd-action | Svelte-native, touch support, works with keyed each blocks |

## Key Design Decisions

### 1. Local-first, server-authoritative
The SQLite database on the host is the source of truth. Clients fetch state via REST and receive real-time updates via WebSocket. No offline-first complexity — the LAN is assumed available.

### 2. Per-week data model
Tasks and habit completions are scoped to a week (identified by the Sunday start date). This enables week navigation without loading all historical data.

### 3. Drag handle for reorder (touch-safe)
Prototype already has swipe-to-delete on touch. Drag-to-reorder uses a dedicated grip handle to avoid gesture conflicts. Cross-day task moves use the handle for drag between day columns (desktop) and a "move to day" action from the swipe menu (mobile).

### 4. Optimistic UI with WebSocket confirmation
Mutations update the local UI immediately, fire an API call, and broadcast via WebSocket. If the API fails, the UI reverts. This gives instant feedback while keeping the server authoritative.

### 5. Tauri spawns the server
The Tauri app starts the SvelteKit Node.js server as a sidecar process. The Tauri webview loads `localhost:<port>`. Other devices connect to the same port over LAN.
