# AeroOS

AeroOS is a modular browser desktop environment with:

- Kernel-style boot and app registration
- Window manager (drag/resize/minimize/maximize/close)
- Taskbar + Start menu + desktop icons + context menu
- Virtual filesystem (IndexedDB persistence)
- Built-in apps: Terminal, File Manager, Text Editor, Settings, Browser
- Frutiger Aero-inspired glass UI

## Run locally

```bash
npm start
```

Then open `http://localhost:4173`.

## Architecture

- `core/`: kernel, event bus, process manager, filesystem, permissions
- `ui/`: desktop shell, windows, taskbar, start menu, notifications
- `apps/`: user apps registered through `AppRegistry`
- `system/`: app registry, theme manager, icon loader

## Terminal commands

`help`, `ls`, `cd`, `pwd`, `mkdir`, `touch`, `rm`, `cat`, `echo`, `clear`, `whoami`, `date`, `tree`
