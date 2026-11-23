# Wavelink service: WhatsApp connection, SQLite, OAuth and the MCP server.
# Needs Node 24+ for the built-in node:sqlite module.
FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .

# Inside a container the service must listen on all interfaces of the container,
# and all private data lives on the /data volume.
ENV MCP_HOST=0.0.0.0 \
    MCP_PORT=3940 \
    DATA_DIR=/data
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3940

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3940/.well-known/oauth-protected-resource').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--no-warnings=ExperimentalWarning", "mcp.js"]
