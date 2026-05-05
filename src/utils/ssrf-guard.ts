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
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1' || host === '[::1]' || host === '::') {
    return `Blocked hostname: ${host}`;
  }

  // IPv4 literal checks (loopback, private ranges, link-local metadata)
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number) as [number, number, number, number];
    if (a === 127) return 'Blocked loopback address';
    if (a === 10) return 'Blocked private range 10.0.0.0/8';
    if (a === 192 && b === 168) return 'Blocked private range 192.168.0.0/16';
    if (a === 172 && b >= 16 && b <= 31) return 'Blocked private range 172.16.0.0/12';
    if (a === 169 && b === 254) return 'Blocked link-local range (cloud metadata)';
    if (a === 0) return 'Blocked 0.0.0.0/8';
  }

  // IPv6 checks — strip brackets for pattern matching
  const ipv6Bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

  // Link-local: fe80::/10 (fe80 – febf)
  if (/^fe[89ab]/i.test(ipv6Bare)) return 'Blocked IPv6 link-local address (fe80::/10)';
  // ULA (unique local): fc00::/7 (fc and fd prefixes)
  if (/^f[cd]/i.test(ipv6Bare)) return 'Blocked IPv6 private range (fc00::/7)';
  // IPv4-mapped: ::ffff:a.b.c.d — re-validate the embedded IPv4 address
  const ipv4MappedMatch = ipv6Bare.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (ipv4MappedMatch) {
    const embeddedResult = validateSsrfUrl(`http://${ipv4MappedMatch[1]}/`);
    if (embeddedResult) return `Blocked IPv4-mapped IPv6: ${embeddedResult}`;
  }

  // IPv4-mapped (compact hex form): ::ffff:HHHH:HHHH — Node.js URL parser
  // canonicalises ::ffff:10.0.0.1 to ::ffff:a00:1, so re-validate by decoding.
  const ipv4MappedHex = ipv6Bare.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
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

  return null;
}
