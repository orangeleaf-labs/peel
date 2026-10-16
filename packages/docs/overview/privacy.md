---
title: Privacy
description: This build sends no telemetry, usage stats, or pings, and reaches the network only for the features listed here.
---

# Privacy

- Your designs, file names, layer names, text, prompts, and keys never leave your device unless you share or sync them yourself.
- This build sends no telemetry: no daily ping, no usage stats, and no install ID. There is nothing to turn off.
- The app has no waitlist or sign-up form and loads no bot-check scripts.

## Network requests

Peel is local-first, but some features reach the network. The desktop app checks for updates on its own; everything else below connects only when you use that feature, and only to the service named. `EGRESS.md` in the repository lists every host.

| Feature | Where it connects |
| --- | --- |
| Update checks (desktop) | The upstream OpenPencil release feed on GitHub, at launch and from the menu; a later Peel release turns this off until an update URL is configured |
| AI chat | The Anthropic API (`api.anthropic.com`), with your own key; the model list ships with the app |
| Cloud storage | The storage endpoint you configure and approve |
| Fonts | Google Fonts and Fontsource (Bunny Fonts and Fontshare if you enable them), only after you turn on Remote fonts in Settings → General |
| Icons | The Iconify API, when you search or insert icons |
| Paste from Figma | Figma, to fetch the images in what you pasted |
| MCP companion | The npm registry, when you install it; the server itself listens only on your computer (`127.0.0.1`) |
