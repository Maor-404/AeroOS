# AeroOS

AeroOS is a modular browser desktop environment with kernel-like subsystems.

## Highlights

- Boot loader simulation with kernel boot logs
- User setup flow with optional Supabase-backed profile sync
- Frutiger Aero SVG avatar integrated into Start Menu + taskbar identity area
- Process manager with PID/state/priority/CPU/memory/thread metadata
- Scheduler simulation (`round-robin`, `priority`, `fcfs`)
- Memory manager with per-process allocation tracking
- Background services (clock/network/update/file watcher/notifications)
- IndexedDB virtual filesystem with CRUD + move/copy/rename
- Package manager (`aeropkg`) with install/remove/list/update/update-system
- App sandbox API + permission prompt model
- Desktop shell (window manager, taskbar, start menu, context menu, notifications)
- Built-in apps: Terminal, File Manager, Text Editor, Settings, Browser, Task Manager, System Monitor

## Run locally

```bash
npm start
```

Then open `http://localhost:4173`.

## Supabase profile setup

On first boot, AeroOS shows a setup modal where you can enter:

- Display name + email
- Optional Supabase URL + anon key

If Supabase is configured, profile data is synced to table `aero_users` via REST API. Without Supabase, AeroOS stores profile locally in `localStorage`.

You can also preconfigure globals before boot:

```html
<script>
  window.AEROOS_SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
  window.AEROOS_SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
</script>
```

## Terminal commands

`help`, `ls`, `cd`, `pwd`, `mkdir`, `touch`, `rm`, `cat`, `echo`, `clear`, `whoami`, `date`, `tree`, `ps`, `kill`, `suspend`, `resume`, `aeropkg`

## `aeropkg` examples

```bash
aeropkg list
aeropkg install notes
aeropkg remove notes
aeropkg update
aeropkg update-system
```
