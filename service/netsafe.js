// Download a file from a public web address for "send this file" requests, without letting the request reach the server
// itself or the private network (other services on this machine, the cloud metadata service, the local network).
// Every address is checked after DNS lookup, the connection goes to that checked address (so DNS can't switch it
// afterwards), redirects are re-checked hop by hop, and size and time are capped.
import http from 'node:http'
import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'

const MAX_BYTES = 30 * 1024 * 1024
const TIMEOUT_MS = 20_000
const MAX_REDIRECTS = 3

// IPv4 ranges that are not the public internet
const BLOCKED_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]
const v4num = (ip) => ip.split('.').reduce((n, o) => (n << 8) + Number(o), 0) >>> 0
const inV4 = (ip, [base, bits]) => bits === 0 || (v4num(ip) >>> (32 - bits)) === (v4num(base) >>> (32 - bits))

export function isPublicIp(ip) {
  if (net.isIPv4(ip)) return !BLOCKED_V4.some((r) => inV4(ip, r))
  if (!net.isIPv6(ip)) return false
  const a = ip.toLowerCase()
  const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/) || a.match(/^::(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPublicIp(mapped[1])
  if (a === '::' || a === '::1') return false
  // link-local fe80::/10, unique-local fc00::/7, multicast ff00::/8, site-local fec0::/10, documentation 2001:db8::/32, NAT64 64:ff9b::/96
  if (/^(fe[89ab]|fc|fd|ff|fe[c-f])/.test(a) || a.startsWith('2001:db8') || a.startsWith('64:ff9b')) return false
  return true
}

// DNS lookup that only ever returns public addresses (used for the actual connection)
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err)
    const ok = addresses.filter((x) => isPublicIp(x.address))
    if (!ok.length) return callback(Object.assign(new Error('That address points to a private or internal network, which is not allowed.'), { code: 'EBLOCKED' }))
    if (options?.all) return callback(null, ok)
    callback(null, ok[0].address, ok[0].family)
  })
}

function getOnce(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return reject(new Error('Only http and https links can be sent.'))
    if (u.username || u.password) return reject(new Error('Links with a username or password are not allowed.'))
    if (net.isIP(u.hostname.replace(/^\[|\]$/g, '')) && !isPublicIp(u.hostname.replace(/^\[|\]$/g, ''))) {
      return reject(new Error('That address points to a private or internal network, which is not allowed.'))
    }
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.get(u, { lookup: safeLookup, timeout: TIMEOUT_MS, headers: { 'user-agent': 'whatsapp-connector/1.0', accept: '*/*' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume()
        return resolve({ redirect: new URL(res.headers.location || '', u).toString() })
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume()
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`))
      }
      const declared = Number(res.headers['content-length'] || 0)
      if (declared > MAX_BYTES) {
        res.destroy()
        return reject(new Error('That file is larger than 30 MB.'))
      }
      const chunks = []
      let size = 0
      res.on('data', (c) => {
        size += c.length
        if (size > MAX_BYTES) {
          res.destroy()
          reject(new Error('That file is larger than 30 MB.'))
        } else chunks.push(c)
      })
      res.on('end', () => resolve({ buf: Buffer.concat(chunks), type: res.headers['content-type'] || null, url: u.toString() }))
      res.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('The download took too long.')))
    req.on('error', (e) => reject(e.code === 'EBLOCKED' ? new Error(e.message) : e))
  })
}

/** Download a public web file. Returns { buf, type, url } (url = final address after redirects). */
export async function fetchPublic(url) {
  let current = url
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const r = await getOnce(current)
    if (!r.redirect) return r
    current = r.redirect
  }
  throw new Error('Too many redirects.')
}
