export const site = {
  name: "Wavelink",
  tagline: "Your WhatsApp, inside ChatGPT and Claude.",
  description:
    "Self-hosted MCP server and dashboard that connects your WhatsApp to ChatGPT, Claude, Cursor and any MCP client. Catch up on chats, hear voice notes, draft replies and send messages from any AI app.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://wavelink.dev",
  github: "https://github.com/ishqDehlvi/wavelink",
  author: { name: "Inzemam", url: "https://www.inzemam.tech/", github: "https://github.com/ishqDehlvi" },
  editBase: "https://github.com/ishqDehlvi/wavelink/edit/main/docs/",
  blobBase: "https://github.com/ishqDehlvi/wavelink/blob/main/",
  disclaimer:
    "Wavelink is an independent open-source project. It is not affiliated with, endorsed by or supported by WhatsApp LLC, Meta Platforms, OpenAI, Anthropic or Google. It uses the WhatsApp Web protocol through the Baileys library, which is not an official API; automated or bulk messaging is against WhatsApp's terms and can get a number banned. Use it on your own number, for your own conversations. The names WhatsApp, ChatGPT, Claude and Gemini are trademarks of their respective owners.",
};
