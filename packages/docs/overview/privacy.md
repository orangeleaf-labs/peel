---
title: Privacy
description: This build sends no telemetry, usage stats, or pings, and reaches the network only for the features listed here.
---

# Privacy

- Your designs, file names, layer names, text, prompts, and keys never leave your device unless you share or sync them yourself.
- This build sends no telemetry: no daily ping, no usage stats, and no install ID. There is nothing to turn off.
- The app has no waitlist or sign-up form and loads no bot-check scripts.

## Network requests

OpenPencil is local-first, but some features reach the network. The desktop app checks for updates on its own; everything else below connects only when you use that feature, and only to the service named.

| Feature | Where it connects |
| --- | --- |
| Update checks (desktop) | GitHub Releases, for the latest version number |
| AI chat | The Anthropic API (`api.anthropic.com`), with your own key; the model list ships with the app |
| Collaboration rooms | Other people in the room directly; public brokers introduce peers, and a TURN relay carries traffic when a direct connection is not possible |
| Cloud storage | The storage provider you configure |
| Fonts | Google Fonts, which can supply a font a document uses that is not installed |
| Icons | The Iconify API, when you search or insert icons |
| Stock images | Unsplash or Pexels, when you search them |
