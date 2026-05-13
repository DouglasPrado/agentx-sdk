/**
 * Shared SSRF validation — used by WebFetch and MCPAdapter.
 * Returns null if the URL is safe, or an error message string if blocked.
 */
export function validateSsrfUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return 'Invalid URL';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `Blocked scheme: ${parsed.protocol}`;
  }

  const host = parsed.hostname.toLowerCase();

  // Loopback and wildcard hostnames
  if (host === 'localhost' || host === '0.0.0.0' || host === '[::1]' || host === '::') {
    return `Blocked hostname: ${host}`;
  }

  // IPv4 literal checks (loopback, private ranges, link-local metadata)
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b, c] = ipv4.slice(1).map(Number) as [number, number, number, number];
    if (a === 127) return 'Blocked loopback address';
    if (a === 10) return 'Blocked private range 10.0.0.0/8';
    if (a === 192 && b === 168) return 'Blocked private range 192.168.0.0/16';
    if (a === 172 && b >= 16 && b <= 31) return 'Blocked private range 172.16.0.0/12';
    if (a === 169 && b === 254) return 'Blocked link-local range (cloud metadata)';
    if (a === 100 && b >= 64 && b <= 127) return 'Blocked shared address space 100.64.0.0/10';
    if (a === 198 && b >= 18 && b <= 19) return 'Blocked benchmarking range 198.18.0.0/15';
    if (a === 192 && b === 0 && c === 2) return 'Blocked documentation range 192.0.2.0/24';
    if (a === 198 && b === 51 && c === 100) return 'Blocked documentation range 198.51.100.0/24';
    if (a === 203 && b === 0 && c === 113) return 'Blocked documentation range 203.0.113.0/24';
    if (a === 0) return 'Blocked 0.0.0.0/8';
  }

  // IPv6 checks — strip brackets for pattern matching
  const ipv6Bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

  // Link-local: fe80::/10 (fe80 – febf)
  if (/^fe[89ab]/i.test(ipv6Bare)) return 'Blocked IPv6 link-local address (fe80::/10)';
  // ULA (unique local): fc00::/7 (fc and fd prefixes)
  if (/^f[cd]/i.test(ipv6Bare)) return 'Blocked IPv6 private range (fc00::/7)';
  // IPv4-mapped: ::ffff:a.b.c.d — re-validate the embedded IPv4 address
  const ipv4MappedMatch = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ipv6Bare);
  if (ipv4MappedMatch) {
    const embeddedResult = validateSsrfUrl(`http://${ipv4MappedMatch[1]}/`);
    if (embeddedResult) return `Blocked IPv4-mapped IPv6: ${embeddedResult}`;
  }

  // IPv4-mapped (compact hex form): ::ffff:HHHH:HHHH — Node.js URL parser
  // canonicalises ::ffff:10.0.0.1 to ::ffff:a00:1, so re-validate by decoding.
  const ipv4MappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ipv6Bare);
  if (ipv4MappedHex) {
    const high = parseInt(ipv4MappedHex[1]!, 16);
    const low = parseInt(ipv4MappedHex[2]!, 16);
    const a = (high >> 8) & 0xff;
    const b = high & 0xff;
    const c = (low >> 8) & 0xff;
    const d = low & 0xff;
    const embeddedResult = validateSsrfUrl(`http://${a}.${b}.${c}.${d}/`);
    if (embeddedResult) return `Blocked IPv4-mapped IPv6 (compact form): ${embeddedResult}`;
  }

  // NAT64: 64:ff9b::/96 (RFC 6146) — translates IPv4 addresses to IPv6 on NAT64 networks.
  // Dot-decimal form: 64:ff9b::a.b.c.d
  const nat64Dot = /^64:ff9b::(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ipv6Bare);
  if (nat64Dot) {
    const embeddedResult = validateSsrfUrl(`http://${nat64Dot[1]}/`);
    if (embeddedResult) return `Blocked NAT64 address: ${embeddedResult}`;
  }
  // Compact hex form: 64:ff9b::HHHH:HHHH (Node.js URL parser canonicalises dot-decimal to this)
  const nat64Hex = /^64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ipv6Bare);
  if (nat64Hex) {
    const high = parseInt(nat64Hex[1]!, 16);
    const low = parseInt(nat64Hex[2]!, 16);
    const a = (high >> 8) & 0xff;
    const b = high & 0xff;
    const c = (low >> 8) & 0xff;
    const d = low & 0xff;
    const embeddedResult = validateSsrfUrl(`http://${a}.${b}.${c}.${d}/`);
    if (embeddedResult) return `Blocked NAT64 address (compact form): ${embeddedResult}`;
  }

  return null;
}
