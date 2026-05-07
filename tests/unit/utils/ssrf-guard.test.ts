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
});
