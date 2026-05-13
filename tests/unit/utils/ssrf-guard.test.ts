import { describe, it, expect } from 'vitest';
import { validateSsrfUrl } from '../../../src/utils/ssrf-guard.js';

describe('validateSsrfUrl', () => {
  it('allows public IPv4', () => {
    expect(validateSsrfUrl('https://1.1.1.1/')).toBeNull();
    expect(validateSsrfUrl('https://8.8.8.8/')).toBeNull();
  });

  it('blocks loopback 127.x', () => {
    expect(validateSsrfUrl('http://127.0.0.1/')).not.toBeNull();
    expect(validateSsrfUrl('http://127.1.2.3/')).not.toBeNull();
  });

  it('blocks 10.0.0.0/8', () => {
    expect(validateSsrfUrl('http://10.0.0.1/')).not.toBeNull();
    expect(validateSsrfUrl('http://10.255.255.255/')).not.toBeNull();
  });

  it('blocks 172.16.0.0/12', () => {
    expect(validateSsrfUrl('http://172.16.0.1/')).not.toBeNull();
    expect(validateSsrfUrl('http://172.31.255.255/')).not.toBeNull();
  });

  it('blocks 192.168.0.0/16', () => {
    expect(validateSsrfUrl('http://192.168.1.1/')).not.toBeNull();
  });

  it('blocks link-local 169.254.0.0/16', () => {
    expect(validateSsrfUrl('http://169.254.169.254/')).not.toBeNull();
  });

  it('blocks 0.0.0.0/8', () => {
    expect(validateSsrfUrl('http://0.0.0.1/')).not.toBeNull();
  });

  it('blocks localhost hostname', () => {
    expect(validateSsrfUrl('http://localhost/')).not.toBeNull();
  });

  it('blocks non-http/https schemes', () => {
    expect(validateSsrfUrl('file:///etc/passwd')).not.toBeNull();
    expect(validateSsrfUrl('ftp://example.com/')).not.toBeNull();
  });

  // issue #141 — RFC 6598 Shared Address Space (CGNAT) 100.64.0.0/10
  describe('CGNAT shared address space 100.64.0.0/10 (issue #141)', () => {
    it('blocks 100.64.0.1 (start of CGNAT range)', () => {
      expect(validateSsrfUrl('http://100.64.0.1/')).not.toBeNull();
    });

    it('blocks 100.100.0.1 (mid CGNAT range)', () => {
      expect(validateSsrfUrl('http://100.100.0.1/')).not.toBeNull();
    });

    it('blocks 100.127.255.255 (end of CGNAT range)', () => {
      expect(validateSsrfUrl('http://100.127.255.255/')).not.toBeNull();
    });

    it('allows 100.63.255.255 (just below CGNAT range)', () => {
      expect(validateSsrfUrl('http://100.63.255.255/')).toBeNull();
    });

    it('allows 100.128.0.0 (just above CGNAT range)', () => {
      expect(validateSsrfUrl('http://100.128.0.0/')).toBeNull();
    });
  });

  // issue #213 — missing IANA reserved ranges
  describe('missing IANA reserved ranges (#213)', () => {
    it('blocks 198.18.0.0/15 (benchmarking, RFC 2544)', () => {
      expect(validateSsrfUrl('http://198.18.0.1/')).not.toBeNull();
      expect(validateSsrfUrl('http://198.19.255.255/')).not.toBeNull();
    });

    it('allows addresses just outside 198.18.0.0/15', () => {
      expect(validateSsrfUrl('http://198.17.255.255/')).toBeNull();
      expect(validateSsrfUrl('http://198.20.0.0/')).toBeNull();
    });

    it('blocks 192.0.2.0/24 (TEST-NET-1, RFC 5737)', () => {
      expect(validateSsrfUrl('http://192.0.2.1/')).not.toBeNull();
      expect(validateSsrfUrl('http://192.0.2.255/')).not.toBeNull();
    });

    it('blocks 198.51.100.0/24 (TEST-NET-2, RFC 5737)', () => {
      expect(validateSsrfUrl('http://198.51.100.1/')).not.toBeNull();
      expect(validateSsrfUrl('http://198.51.100.255/')).not.toBeNull();
    });

    it('blocks 203.0.113.0/24 (TEST-NET-3, RFC 5737)', () => {
      expect(validateSsrfUrl('http://203.0.113.1/')).not.toBeNull();
      expect(validateSsrfUrl('http://203.0.113.255/')).not.toBeNull();
    });
  });

  // issue #236 — IPv6 unspecified address [::] not blocked (host === '::' is dead code)
  describe('IPv6 unspecified address [::] blocked (issue #236)', () => {
    it('blocks http://[::] — IPv6 all-zeros unspecified address', () => {
      expect(validateSsrfUrl('http://[::]/')).not.toBeNull();
    });

    it('blocks https://[::] as well', () => {
      expect(validateSsrfUrl('https://[::]/')).not.toBeNull();
    });

    it('still blocks [::1] loopback IPv6', () => {
      expect(validateSsrfUrl('http://[::1]/')).not.toBeNull();
    });

    it('still allows a public IPv6 address', () => {
      expect(validateSsrfUrl('https://[2606:4700:4700::1111]/')).toBeNull();
    });
  });

  // issue #190 — NAT64 prefix 64:ff9b::/96 (RFC 6146) not blocked
  describe('NAT64 64:ff9b::/96 (issue #190)', () => {
    it('blocks NAT64 with embedded private 10.0.0.1 (dot-decimal form)', () => {
      expect(validateSsrfUrl('http://[64:ff9b::10.0.0.1]/')).not.toBeNull();
    });

    it('blocks NAT64 with embedded private 192.168.1.1 (dot-decimal form)', () => {
      expect(validateSsrfUrl('http://[64:ff9b::192.168.1.1]/')).not.toBeNull();
    });

    it('blocks NAT64 with embedded loopback 127.0.0.1 (dot-decimal form)', () => {
      expect(validateSsrfUrl('http://[64:ff9b::127.0.0.1]/')).not.toBeNull();
    });

    it('blocks NAT64 with embedded link-local 169.254.0.1 (dot-decimal form)', () => {
      expect(validateSsrfUrl('http://[64:ff9b::169.254.0.1]/')).not.toBeNull();
    });

    it('blocks NAT64 with embedded 172.16.0.1 (compact hex form ac10:1)', () => {
      expect(validateSsrfUrl('http://[64:ff9b::ac10:1]/')).not.toBeNull();
    });

    it('blocks NAT64 with embedded 10.0.0.1 (compact hex form a00:1)', () => {
      expect(validateSsrfUrl('http://[64:ff9b::a00:1]/')).not.toBeNull();
    });

    it('allows NAT64 with embedded public IP 1.1.1.1 (dot-decimal form)', () => {
      expect(validateSsrfUrl('http://[64:ff9b::1.1.1.1]/')).toBeNull();
    });

    it('allows NAT64 with embedded public IP 8.8.8.8 (compact hex form 808:808)', () => {
      expect(validateSsrfUrl('http://[64:ff9b::808:808]/')).toBeNull();
    });
  });
});
