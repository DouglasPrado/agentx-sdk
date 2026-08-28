import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')) as Record<
  string,
  unknown
>;
const releaseYml = readFileSync(resolve(__dirname, '../../.github/workflows/release.yml'), 'utf-8');

describe('package.json security overrides (issue #26)', () => {
  it('should have a top-level "overrides" field for npm compatibility', () => {
    expect(pkg).toHaveProperty('overrides');
    expect(typeof pkg.overrides).toBe('object');
  });

  it('should pin hono to >=4.12.25 to fix GHSA-26pp, GHSA-r5rp, GHSA-xf4j, GHSA-wmmm, GHSA-458j, GHSA-xpcf, GHSA-9vqf, GHSA-69xw, GHSA-88fw', () => {
    const overrides = pkg.overrides as Record<string, string>;
    expect(overrides).toHaveProperty('hono');
    // Must satisfy >=4.12.25 (minimum for all hono CVEs incl. GHSA-88fw CORS origin reflection)
    expect(overrides.hono).toBe('>=4.12.25');
  });

  it('should pin @hono/node-server to >=1.19.13 to fix GHSA-92pp', () => {
    const overrides = pkg.overrides as Record<string, string>;
    expect(overrides).toHaveProperty('@hono/node-server');
    expect(overrides['@hono/node-server']).toBe('>=1.19.13');
  });

  it('should pin postcss to >=8.5.10 to fix GHSA-qx2v', () => {
    const overrides = pkg.overrides as Record<string, string>;
    expect(overrides).toHaveProperty('postcss');
    expect(overrides.postcss).toBe('>=8.5.10');
  });
});

describe('pnpm overrides — hono >=4.12.25 (incl. GHSA-88fw CORS) (issue #143)', () => {
  it('pins hono to >=4.12.25 in pnpm.overrides to fix bodyLimit bypass, JSX HTML Injection and CORS origin reflection', () => {
    const pnpmSection = pkg.pnpm as { overrides?: Record<string, string> } | undefined;
    const overrides = pnpmSection?.overrides ?? {};
    expect(overrides.hono).toMatch(/^>=4\.12\.(2[5-9]|[3-9]\d|\d{3,})/);
  });

  it('pins hono to >=4.12.25 in top-level overrides for npm compatibility (issue #143)', () => {
    const overrides = pkg.overrides as Record<string, string>;
    expect(overrides.hono).toMatch(/^>=4\.12\.(2[5-9]|[3-9]\d|\d{3,})/);
  });
});

describe('pnpm overrides — CVE-2026-42338 ip-address XSS (issue #115)', () => {
  it('should pin ip-address to >=10.1.1 in pnpm.overrides to fix CVE-2026-42338', () => {
    const pnpmSection = pkg.pnpm as { overrides?: Record<string, string> } | undefined;
    const overrides = pnpmSection?.overrides ?? {};
    expect(overrides).toHaveProperty('ip-address');
    expect(overrides['ip-address']).toBe('>=10.1.1');
  });

  it('should also pin ip-address in top-level overrides for npm compatibility (issue #115)', () => {
    const overrides = pkg.overrides as Record<string, string>;
    expect(overrides).toHaveProperty('ip-address');
    expect(overrides['ip-address']).toBe('>=10.1.1');
  });
});

describe('release.yml — release-please based, no manual git push to main', () => {
  // O fluxo antigo (custom shell em release.yml) tinha 2 vulnerabilidades historicas:
  //   - issue #89: `git reset --hard` silenciosamente descartava commits concorrentes
  //   - issue #51: `${{ steps.version.outputs.version }}` direto em run: era shell injection
  //
  // Migramos pra googleapis/release-please-action (PR #138) que faz tudo internamente.
  // Os checks abaixo garantem que a refatoracao nao reintroduz os antipatterns:

  it('does NOT use git reset --hard (regression: issue #89)', () => {
    expect(releaseYml).not.toMatch(/git\s+reset\s+--hard/);
  });

  it('does NOT execute custom git push to main from a run: step (regression: issue #89)', () => {
    // release-please cria PRs e GitHub Releases via API — nao precisa push direto.
    // Push direto bypassa branch protection.
    expect(releaseYml).not.toMatch(/git\s+push\s+origin\s+main/);
  });

  it('does NOT interpolate version output directly in run: shell (regression: issue #51)', () => {
    // Padrao perigoso: VERSION=${{ steps.X.outputs.Y }} em run: bash
    expect(releaseYml).not.toMatch(/VERSION=\$\{\{[^}]*steps\.[a-z_]+\.outputs/);
  });

  it('uses release-please-action pinned to a SHA (supply chain)', () => {
    expect(releaseYml).toMatch(/googleapis\/release-please-action@[a-f0-9]{40}\s*#\s*v\d/);
  });

  it('publishes to npm only when release-please created a release', () => {
    // Guard pra evitar publish em todo push — apenas quando ha tag nova
    expect(releaseYml).toMatch(/release-please\.outputs\.release_created\s*==\s*'true'/);
  });
});

describe('pnpm overrides — CVE-2026-6321 + CVE-2026-6322 fast-uri path-traversal & host-confusion (issue #163)', () => {
  it('pins fast-uri to >=3.1.2 in pnpm.overrides to fix CVE-2026-6321 and CVE-2026-6322', () => {
    const pnpmSection = pkg.pnpm as { overrides?: Record<string, string> } | undefined;
    const overrides = pnpmSection?.overrides ?? {};
    expect(overrides).toHaveProperty('fast-uri');
    expect(overrides['fast-uri']).toBe('>=3.1.2');
  });

  it('pins fast-uri to >=3.1.2 in top-level overrides for npm compatibility (issue #163)', () => {
    const overrides = pkg.overrides as Record<string, string>;
    expect(overrides).toHaveProperty('fast-uri');
    expect(overrides['fast-uri']).toBe('>=3.1.2');
  });
});
