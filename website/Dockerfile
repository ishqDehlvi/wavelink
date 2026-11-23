# Build from the repository root:  docker build -f website/Dockerfile -t wavelink-website .
FROM node:24-alpine AS build
WORKDIR /app/website
COPY website/package.json website/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY website/ ./
# The docs live one level up in the repository; copy them next to the site so the ./docs fallback is used.
COPY docs/ ./docs/
ARG NEXT_PUBLIC_SITE_URL=https://wavelink.dev
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S web && adduser -S web -G web
COPY --from=build --chown=web:web /app/website/.next/standalone ./
COPY --from=build --chown=web:web /app/website/.next/static ./.next/static
COPY --from=build --chown=web:web /app/website/public ./public
USER web
EXPOSE 3000
CMD ["node", "server.js"]
