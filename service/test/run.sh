#!/usr/bin/env bash
# Security and isolation tests. Runs a throwaway copy of the service on port 3977 with fake data only
# (no WhatsApp connection, no real chats), then runs the three test suites against it.
#   cd service && bash test/run.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TESTS="$HERE/test"
T="$(mktemp -d)"
# throwaway credentials for the test servers, new on every run
rnd() { node -e "process.stdout.write(require('crypto').randomBytes(12).toString('hex'))"; }
ADMIN_USER=owner ADMIN_PASS="$(rnd)" KEY="$(rnd)" DEMO_PASS="$(rnd)" DEMO_KEY="$(rnd)"
PORT=3977
cleanup() { [ -n "${PID:-}" ] && kill "$PID" 2>/dev/null || true; [ -n "${DPID:-}" ] && kill "$DPID" 2>/dev/null || true; rm -rf "$T"; }
trap cleanup EXIT

cp "$HERE"/{mcp,workspace,users,oauth,attachments,netsafe}.js "$HERE/package.json" "$T/"
cp -R "$HERE/demo" "$T/demo"
ln -s "$HERE/node_modules" "$T/node_modules"
cd "$T"
printf '%s' "$KEY" > .mcp-token
mkdir -p auth-mcp downloads && echo '{"mode":"off"}' > autoreply.json
# a fake "old single-user" install, to test the migration to the superadmin account
node --no-warnings -e "
const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('whatsapp.db');
d.exec(\"CREATE TABLE chats (jid TEXT PRIMARY KEY, alt_jid TEXT, name TEXT, is_group INTEGER, last_ts INTEGER DEFAULT 0);CREATE TABLE messages (chat_jid TEXT, id TEXT, from_jid TEXT, from_name TEXT, from_me INTEGER, ts INTEGER, text TEXT, media_type TEXT, raw TEXT, PRIMARY KEY (chat_jid, id));CREATE TABLE oauth_clients (client_id TEXT PRIMARY KEY, secret_hash TEXT, name TEXT, redirect_uris TEXT, created INTEGER);CREATE TABLE oauth_tokens (token_hash TEXT PRIMARY KEY, kind TEXT, client_id TEXT, scope TEXT, expires INTEGER, created INTEGER);\");
const now=Math.floor(Date.now()/1000);
d.prepare('INSERT INTO chats VALUES (?,?,?,?,?)').run('911111111111@s.whatsapp.net',null,'Alice (admin contact)',0,now);
d.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?)').run('911111111111@s.whatsapp.net','ADMINMSG1','911111111111@s.whatsapp.net','Alice',0,now,'SECRET-ADMIN-INVOICE 5000',null,'{}');
d.prepare('INSERT INTO oauth_clients VALUES (?,?,?,?,?)').run('legacyclient',null,'ChatGPT','[\"https://chatgpt.com/cb\"]',now);
const sha=s=>require('crypto').createHash('sha256').update(s).digest('hex');
d.prepare('INSERT INTO oauth_tokens VALUES (?,?,?,?,?,?)').run(sha('legacy-access-token'),'access','legacyclient','whatsapp',now+3600,now);
d.close();"

WA_NO_CONNECT=1 DASHBOARD_USER="$ADMIN_USER" DASHBOARD_PASSWORD="$ADMIN_PASS" MCP_PORT=$PORT MCP_TOKEN= GEMINI_API_KEY= \
  node --no-warnings mcp.js > "$T/server.log" 2>&1 &
PID=$!
for _ in $(seq 1 30); do curl -s -o /dev/null "http://127.0.0.1:$PORT/.well-known/oauth-protected-resource" && break; sleep 0.3; done

B="http://127.0.0.1:$PORT"
status=0
node --no-warnings "$TESTS/isolation.test.mjs" "$B" "$KEY" "$T/data" "$ADMIN_USER" "$ADMIN_PASS" || status=1
node --no-warnings "$TESTS/admin.test.mjs" "$B" "$KEY" "$T/data" "$ADMIN_USER" "$ADMIN_PASS" || status=1
node --no-warnings "$TESTS/security.test.mjs" "$B" "$KEY" "$T/data" "$T/netsafe.js" || status=1
node --no-warnings "$TESTS/forward.test.mjs" "$B" "$KEY" "$T/data" "$ADMIN_USER" "$ADMIN_PASS" || status=1
node --no-warnings "$TESTS/translate.test.mjs" "$B" "$KEY" "$T/data" "$ADMIN_USER" "$ADMIN_PASS" || status=1

# demo mode: a second server with made-up chats only
D="$T/demo-run"
mkdir -p "$D" && cp "$T"/*.js "$T/package.json" "$D/" && cp -R "$T/demo" "$D/demo" && ln -s "$HERE/node_modules" "$D/node_modules"
(cd "$D" && exec env DEMO_MODE=1 DASHBOARD_USER=demo DASHBOARD_PASSWORD="$DEMO_PASS" MCP_PORT=$((PORT + 1)) MCP_TOKEN="$DEMO_KEY" GEMINI_API_KEY= \
  node --no-warnings mcp.js > "$D/server.log" 2>&1) &
DPID=$!
for _ in $(seq 1 30); do curl -s -o /dev/null "http://127.0.0.1:$((PORT + 1))/.well-known/oauth-protected-resource" && break; sleep 0.3; done
node --no-warnings "$TESTS/demo.test.mjs" "http://127.0.0.1:$((PORT + 1))" "$DEMO_KEY" "$D/data" demo "$DEMO_PASS" || { status=1; tail -20 "$D/server.log"; }

[ $status -eq 0 ] && echo "ALL SUITES PASSED" || { echo "SOME TESTS FAILED (server log: below)"; tail -20 "$T/server.log"; }
exit $status
