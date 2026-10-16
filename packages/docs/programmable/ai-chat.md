---
title: AI Chat
description: Built-in AI assistant with 90+ tools for creating and modifying designs.
---

# AI Chat

Press <kbd>⌘</kbd><kbd>J</kbd> (<kbd>Ctrl</kbd> + <kbd>J</kbd>) to open the AI assistant. Describe what you want — it creates shapes, sets styles, manages layout, works with components, and analyzes your design.

## Setup

The first time you open OpenPencil, guided setup asks what AI should help with and whether you have an Anthropic API key. It connects that key and assigns it to the **Design agent** and **Vision** roles, keeping anything you configured by hand. Skip it to start designing, and run it again from **Settings → AI & agents → Run guided setup**. To configure models by hand:

1. Open the AI chat panel (<kbd>⌘</kbd><kbd>J</kbd>)
2. Click the settings icon
3. Add a model and choose its Claude model, API key, and capabilities
4. Save the model and assign it to **Design agent**

You can configure multiple reusable models and separately assign models for design work, reviews, fast tasks, and image input. Models using the same provider connection reuse its stored credential.

The chat composer grows with multiline prompts and can pin the current canvas selection as explicit node context. Assistant messages show provider reasoning in collapsible sections and provide a per-response copy action. Image attachments remain available for visual references when a Vision model is configured. Streaming responses use a hardened Markdown renderer with Shiki-highlighted code blocks; unsafe link protocols and embedded data images are blocked.

## Step limit

In **Settings → AI & agents → Chat**, set **Maximum steps per message** to a whole number from 1 to 1,000. The default is 50. Press Enter or leave the field to save a valid value; invalid drafts do not replace the saved preference. Higher limits allow longer tool-driven tasks but can increase latency and provider cost.

The built-in AI captures this limit when each message starts. Stopping, remaining-step warnings, and the **Continue** action use that same budget. Changing it does not interrupt an ongoing request; the next message or continuation uses the new limit. A step is one model iteration and can include multiple tool calls.

## Tool access

Open **Settings → Tool access** to choose which tools the built-in AI can use. Search by name or description, expand read-only or side-effect groups, and toggle individual tools or an entire group. Group switches affect all tools in that group, not only search results. **Restore defaults** restores the default tool set: the core editing and inspection tools, the library tools (`get_components`, `list_libraries`, `insert_library_component`), comments, variables, `lint` and `lint_fix`, `export_image`, `list_pages`, and `create_page`. Extended tools such as `create_component` can be enabled individually.

Preferences are saved locally and apply to the next message, including in an existing conversation. They do not change an already-running request. Enabling many tools increases the schemas sent to the model.

The **Local MCP** segment has independent settings for clients connected to OpenPencil's MCP server, such as coding agents you run yourself. Restart the server and reconnect stdio clients after changing those settings. WebMCP access remains separate.

Tool toggles control which tools are offered. The AI chat never offers `eval` or any other tool that runs model-written scripts; MCP clients get `eval` only when the server enables it.

## Saved Conversations

Use **Conversation history** to return to a saved chat, start a **New chat**, or rename or delete a conversation. History and attachment previews are stored locally; **All chats** lets you browse transcripts from other documents.

A conversation belonging to another document is read-only until you open that document. Local history is not cloud synchronization or a backup.

In the Chat settings beside the model overview, choose whether reasoning is **Collapsed by default**, **Expand while thinking**, or **Expanded by default**. Disclosure animations follow the app's reduced-motion preference. Expanding older reasoning does not force the conversation to scroll to the bottom.

## Provider

Peel talks to the Anthropic API only. Get an API key at [console.anthropic.com](https://console.anthropic.com) and choose a Claude model from the built-in list, which ships with the app, so listing models contacts no other service. Requests go directly from your computer to `api.anthropic.com`; there is no custom base URL. In the desktop app the key is stored in the operating system's credential store (Keychain on macOS, Credential Manager on Windows).

## What It Can Do

The configurable tool catalog covers these categories; the tools offered to a model depend on your Tool access settings:

- **Create** — frames, shapes, text, components, pages. Renders JSX for complex layouts.
- **Style** — fills, strokes, effects, opacity, corner radius, blend modes.
- **Layout** — auto-layout, grid, alignment, spacing, sizing.
- **Components** — create components, instances, component sets, and slots. Manage overrides. Give components Reka UI behaviours so they work in preview.
- **Variables** — create/edit variables, collections, modes. Bind to fills.
- **Query** — find nodes, XPath selectors, read properties, list pages, fonts, selection.
- **Inspect** — `get_jsx` for JSX roundtrip view, `diff_create` and `diff_jsx` for structural diffs, `diff_visual` for pixel diffs, `describe` for semantic role and design issue detection.
- **Analyze** — color palette, typography audit, spacing consistency, cluster detection.
- **Export** — PNG, SVG, JSX with Tailwind classes. Vision-based verification via `export_image`.
- **Vector** — boolean operations, path manipulation.

## Visual Verification

The assistant can verify its work visually. With `export_image`, on by default, it can capture a screenshot after creating or modifying designs and checks the result against the original request. This catches layout issues, missing elements, and color mismatches that text-only responses would miss. `diff_visual`, enabled by default, compares an edited node with a reference copy and returns the changed pixels and region, so the assistant can confirm an edit stayed within its target.

## Stopping a reply

**Stop** ends a reply at once. A tool call already running finishes, and its edit counts as part of the reply; calls still waiting for their turn change nothing. The reply is marked *Stopped*, its reasoning and any unfinished calls stop showing as running, and your next message tells the assistant whether those calls changed the document.

## Undoing the assistant's edits

Each tool call that changes the document is one step in Edit → Undo. Undoing it with <kbd>⌘</kbd><kbd>Z</kbd> marks the call *Undone* in the chat. A reply with only some edits undone says how many; one with all of them undone is dimmed and marked *Changes reverted*. Redo removes the marks. The marks are saved with the conversation.

**Revert changes** on a reply undoes its edits while nothing has been edited since, and **Restore changes** brings undone edits back while Redo still can. **Regenerate** and editing your last message undo the replaced reply's edits first when they can.

Your next message tells the assistant which of its edits you undid or redid, so it does not build on edits that are gone. If you undo the assistant's edits while it is still working, it hears about it with its next tool call.

## Following the assistant

With **Follow agents** on, the crosshair button at the top of the AI panel, your view follows the assistant while it works, including to another page when it edits layers there. Following ends when the reply finishes, is stopped, or fails. Clicking, scrolling, zooming, switching pages, or Escape stops following yourself.

## Example Prompts

- "Create a card with a title, description, and a blue button"
- "Make all buttons on this page use the same border radius"
- "What fonts are used in this file?"
- "Change the background of the selected frame to a gradient from blue to purple"
- "Export the selected frame as SVG"
- "Find all text nodes with font size less than 12"
- "Describe the selected component — what role does it look like?"
- "Show me the JSX for this frame"
- "Make this component a switch that I can try in preview"

## Tips

- Select nodes before asking — the assistant knows what's selected.
- Be specific about colors, sizes, and positions for precise results.
- The assistant can modify multiple nodes in one message.
- You can browse other pages while a reply runs: the assistant keeps working on the page where the message started, and its previews show when you return. While you're away, the chat says which page it is working on, with **Go to page** to return.
- Undo anything you don't like with Edit → Undo or **Revert changes**; the chat and the assistant both see it.
- All layout is recomputed automatically after each tool execution.
