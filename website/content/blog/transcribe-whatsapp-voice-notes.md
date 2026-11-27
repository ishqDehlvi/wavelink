---
title: Transcribe WhatsApp voice notes automatically, in Hindi, Hinglish or English
description: Stop playing every voice note. Here is how Wavelink turns WhatsApp voice notes into text with an English translation, and how ChatGPT and Claude use those transcripts.
date: 2026-11-26
tags: Voice notes, Transcription, Hinglish
---

Voice notes are the fastest way to send a message and the slowest way to read one. A busy WhatsApp means minutes of audio a day, often in a mix of Hindi and English, sometimes with background noise, always at the worst moment to put the phone to your ear.

Wavelink transcribes them for you. Every voice note becomes text, with an English translation when it isn't in English, and that text is what ChatGPT, Claude and the dashboard work with.

## What you get for each voice note

Take a typical message from a supplier:

> **Transcript:** "Bhai kal subah 10 baje aa jana, invoice ready rakhna, Sharma ji bhi aayenge."
>
> **English:** "Come by tomorrow at 10 am, keep the invoice ready, Mr Sharma is coming too."

Hindi and Hinglish are written in Roman script, the way people actually type them on WhatsApp, and English stays English. If there's no speech at all, you get a one-line description of what's in the audio instead.

## When transcription happens

- **New voice notes are transcribed as they arrive**, in the background, one at a time so the AI service isn't flooded.
- **Older voice notes are transcribed when they're needed**: when you open them in the dashboard, or when ChatGPT or Claude reads that chat.
- **Each file is processed once.** The transcript is saved, so asking about the same voice note again is instant and costs nothing.

## How the AI uses the transcripts

Because the transcript sits right under the voice note, everything else just works:

- **Catch-ups include what was said.** "What did I miss today?" covers voice notes, not only typed messages.
- **Search finds spoken words.** Searching for "invoice" finds the voice note where someone mentioned it.
- **Drafts and auto-replies understand the context.** A reply drafted to a voice note answers what was actually said.
- **You can ask directly.** "Open the voice note Sam sent this morning and tell me what it says."

The same goes for the rest of WhatsApp's attachments. Photos and screenshots are described with every visible amount, date and name; PDFs, Word and Excel files are extracted; videos are summarised with their speech.

## What it uses under the hood

Wavelink uses Google's Gemini models with your own API key. You set `GEMINI_API_KEY` on your server, and transcription, attachment reading, summaries and drafts switch on. Leave it empty and WhatsApp still syncs and sends; you just don't get the AI features. The details are in [configuration](/docs/configuration).

Two honest notes:

- **Gemini sees the audio.** To transcribe a voice note, its audio is sent to Google's API under your key. If that's not acceptable for some conversations, don't set a key.
- **Very old voice notes may be gone.** WhatsApp removes media from its servers after a while. If a voice note is too old to download, Wavelink tells you instead of guessing.

## Try it

If you already run Wavelink, open any chat with a voice note in the dashboard; the transcript appears under it. In ChatGPT or Claude, ask "What did the last voice note from Priya say?"

New to Wavelink? Start with [how to use WhatsApp inside ChatGPT](/blog/use-whatsapp-in-chatgpt), or go straight to the [quick start](/docs/quickstart).
