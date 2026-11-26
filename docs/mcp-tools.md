# MCP tools

Wavelink exposes 19 tools. Names, titles and parameters below are exactly what the AI app sees. "Chat" arguments accept a contact or group name, a phone number with country code (`919876543210`, no plus sign) or a WhatsApp jid.

Read tools carry `readOnlyHint: true`. Write tools carry `destructiveHint: false`. The server instructions tell the model to show the exact text and recipient before any send.

## Catching up

| Tool | Parameters | What it returns |
|---|---|---|
| `whatsapp_brief` · Brief me on WhatsApp | `hours` 1–168, default 24 | An AI briefing of the period plus one line per chat with new messages, marked by priority and whether a reply is owed. |
| `whatsapp_waiting` · Who is waiting on my reply | `days` 1–30, default 7 | People (not groups) whose last message has not been answered, newest first, with the count and the last message. |
| `whatsapp_status` · WhatsApp connection status | none | Connected or not, the linked number, chats and messages stored, whether AI is configured. |

## Reading

| Tool | Parameters | What it returns |
|---|---|---|
| `whatsapp_list_chats` · List WhatsApp chats | `query?`, `limit` 1–100, default 20 | Recent chats with their last message. |
| `whatsapp_read_messages` · Read WhatsApp messages | `chat`, `limit` 1–200, default 30, `before?` ISO date | Messages oldest to newest with ids. Attachments show their transcript or contents when already read. |
| `whatsapp_search_messages` · Search WhatsApp messages | `query`, `chat?`, `limit` 1–100, default 20 | Full-text search across stored messages. |
| `whatsapp_search_contacts` · Search WhatsApp contacts | `query` | Contacts and groups matching a name or number, with jids. |
| `whatsapp_read_attachment` · Read a WhatsApp attachment | `chat`, `message_id` | Voice notes and audio transcribed (with an English translation), photos described with all visible text, videos described with speech, PDFs and Office files extracted. Results are cached per file. |

## Writing

| Tool | Parameters | What it does |
|---|---|---|
| `whatsapp_draft_reply` · Draft a reply (does not send) | `chat`, `guidance?` | Writes a reply in the owner's own style from the recent conversation and saved memories. Nothing is sent. |
| `whatsapp_send_message` · Send a WhatsApp message | `to`, `text` | New text message to a person or group. WhatsApp formatting (`*bold*`, `_italic_`, `~strike~`) works. Numbers not in contacts work too. |
| `whatsapp_reply` · Reply to a WhatsApp message | `chat`, `message_id`, `text` | Quoted reply to a specific message. |
| `whatsapp_send_file` · Send a file / photo / video | `to`, one of `url` or `base64`, `filename?`, `mimetype?`, `caption?`, `as_document?`, `reply_to_message_id?` | Sends media or a document. Only public links or uploaded data; files on the server can never be sent. Links are fetched with SSRF protection (no private addresses, redirects re-checked, 30 MB cap). |
| `whatsapp_forward_message` · Forward a WhatsApp message | `chat`, `message_id`, `to[]` 1–5 | Forwards an existing message (text, photo, video, voice note or document) to up to 5 people or groups as a real WhatsApp forward with the "Forwarded" label. Media goes along without re-uploading. Recipients must resolve to WhatsApp chats, and view-once messages are refused, as in WhatsApp itself. |
| `whatsapp_create_group` · Create a WhatsApp group | `name`, `participants[]` | Creates a group with the given numbers or contact names. |

## Memory

| Tool | Parameters | What it does |
|---|---|---|
| `whatsapp_remember` · Remember something | `note` 3–500 chars | Saves a lasting fact or preference. Used by future requests, drafts and auto-replies. |
| `whatsapp_memories` · What do you remember? | none | Lists saved notes with ids. |
| `whatsapp_forget` · Forget a saved note | `id` | Deletes a note. |

## Automation

| Tool | Parameters | What it does |
|---|---|---|
| `whatsapp_auto_reply` · Auto-reply settings | `mode?` off/allowlist/all, `allow?[]`, `exclude?[]`, `pauseMinutes?` 0–1440 | View or change AI auto-reply for 1:1 chats. Groups are never auto-replied. Call with no arguments to view. |

## Organisations

| Tool | Parameters | What it does |
|---|---|---|
| `whatsapp_accounts` · Accounts in your organisation | none | Superadmin only. Lists every account with its link status. |

When the signed-in user is a superadmin, every read tool above gains an optional `account` parameter (username, name or number). Results are prefixed `[Account: …, read-only]`, every such view is logged and shown to the account's owner, and write tools refuse any `account` other than the superadmin's own. See [accounts](accounts.md).

## Server instructions

Besides tools, each session receives instructions: whose WhatsApp it is, which tool answers "what did I miss", how attachments work, the show-before-send rule, and the list of saved memories. This is why the experience is consistent across ChatGPT, Claude and other clients without per-client prompting.
