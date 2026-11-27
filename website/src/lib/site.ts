export const site = {
  name: "Wavelink",
  tagline: "Your WhatsApp and Notion, inside ChatGPT and Claude.",
  description:
    "Self-hosted MCP server and dashboard that brings your WhatsApp and your team's Notion into ChatGPT, Claude, Cursor and any MCP client. Catch up on chats, hear voice notes, reply, and read or update Notion pages, with access set per person and per page.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://wavelink.inzemam.tech",
  github: "https://github.com/ishqDehlvi/wavelink",
  /** the Show HN launch thread */
  hackerNews: "https://news.ycombinator.com/item?id=50645583",
  logo: "/brand/wavelink-512.png",
  /** search phrases people use for this; feeds meta keywords, schema keywords and llms.txt */
  keywords: [
    "WhatsApp MCP server",
    "WhatsApp ChatGPT integration",
    "connect WhatsApp to ChatGPT",
    "WhatsApp Claude integration",
    "connect WhatsApp to Claude",
    "Model Context Protocol WhatsApp",
    "open source WhatsApp MCP",
    "self-hosted WhatsApp AI assistant",
    "WhatsApp AI assistant",
    "WhatsApp voice note transcription",
    "WhatsApp Hinglish to English",
    "WhatsApp chat summary AI",
    "WhatsApp auto reply AI",
    "ChatGPT custom connector",
    "Claude custom connector",
    "Cursor MCP WhatsApp",
    "Claude Code MCP",
    "Baileys WhatsApp",
    "WhatsApp dashboard",
    "WhatsApp for business owners",
    "Notion MCP server",
    "Notion in ChatGPT",
    "Notion permissions per page",
  ],
  author: { name: "Inzemamul Haq", short: "inzemam.tech", url: "https://www.inzemam.tech/", github: "https://github.com/ishqDehlvi", hackerNews: "https://news.ycombinator.com/user?id=ishqdehlvi" },
  /** done-for-you setup by the maker */
  setup: "https://www.inzemam.tech/",
  editBase: "https://github.com/ishqDehlvi/wavelink/edit/main/docs/",
  blobBase: "https://github.com/ishqDehlvi/wavelink/blob/main/",
  disclaimer:
    "Wavelink is an independent open-source project. It is not affiliated with, endorsed by or supported by WhatsApp LLC, Meta Platforms, OpenAI, Anthropic or Google. It uses the WhatsApp Web protocol through the Baileys library, which is not an official API; automated or bulk messaging is against WhatsApp's terms and can get a number banned. Use it on your own number, for your own conversations. The names WhatsApp, ChatGPT, Claude and Gemini are trademarks of their respective owners.",
};
