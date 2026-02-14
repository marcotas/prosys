# Brief

## Problem

Families lack a simple, shared tool to manage weekly tasks and track habits together. Existing apps are either cloud-dependent (privacy concerns, subscriptions) or single-user. Spreadsheets work but don't sync across devices in real-time and aren't mobile-friendly.

## Target User

Families of 6+ members who want to organize weekly tasks and build habits together, using devices they already own (Macs, iPhones, iPads) on their home network.

## Value Proposition

A private, self-hosted family productivity hub that runs entirely on the local network -- no cloud, no subscriptions, no accounts to create. Any family member picks up any device and sees the family's weekly plan, checks off tasks, and tracks habits in real-time.

## Key Features

- **Weekly dashboard**: 7-day view with daily task lists, completion percentages, and overall weekly progress (mirroring the proven spreadsheet layout)
- **Habit tracker**: Define habits, check them off daily, see weekly progress per habit
- **Family profiles**: Each family member has their own tasks and habits, with a shared family overview
- **Real-time sync**: Changes on one device appear instantly on all others via WebSocket over local network
- **Auto-discovery**: Devices find the server automatically via mDNS (Bonjour) -- no IP addresses to type
- **Host anywhere**: Any Mac can be the server; phones and tablets connect via browser/PWA
- **Motivational quotes**: Weekly rotating quotes on the dashboard (configurable)

## Constraints

- Local network only -- no cloud, no internet required
- Must work on macOS (native app via Tauri v2) and iOS (PWA via Safari)
- Data stored in SQLite on the host device
- Family of 6+ members
- Any device can take the host role
