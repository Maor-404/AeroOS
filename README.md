# AeroOS

AeroOS is a modular browser desktop environment with kernel-like subsystems.

## Highlights

- Boot loader simulation with kernel boot logs
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

## SDK example

```js
AeroOS.createApp({
  name: 'My App',
  icon: '🧩',
  permissions: ['filesystem.write'],
  launch({ api, mount }) {
    mount.innerHTML = '<button id="save">Save</button>';
    mount.querySelector('#save').onclick = () => api.filesystem.write('/home/user/Documents/my.txt', 'hello');
  },
});
```
