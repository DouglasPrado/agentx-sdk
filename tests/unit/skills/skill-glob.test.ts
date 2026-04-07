import { describe, it, expect } from 'vitest';
import { matchGlob, matchAnyGlob, globToRegex } from '../../../src/skills/skill-glob.js';

describe('skill-glob', () => {
  describe('matchGlob', () => {
    it('should match exact paths', () => {
      expect(matchGlob('src/index.ts', 'src/index.ts')).toBe(true);
      expect(matchGlob('src/index.ts', 'src/other.ts')).toBe(false);
    });

    it('should match * (single segment wildcard)', () => {
      expect(matchGlob('src/*.ts', 'src/index.ts')).toBe(true);
      expect(matchGlob('src/*.ts', 'src/agent.ts')).toBe(true);
      expect(matchGlob('src/*.ts', 'src/deep/index.ts')).toBe(false);
      expect(matchGlob('*.ts', 'index.ts')).toBe(true);
    });

    it('should match ** (recursive wildcard)', () => {
      expect(matchGlob('src/**/*.ts', 'src/index.ts')).toBe(true);
      expect(matchGlob('src/**/*.ts', 'src/core/loop.ts')).toBe(true);
      expect(matchGlob('src/**/*.ts', 'src/a/b/c/deep.ts')).toBe(true);
      expect(matchGlob('src/**/*.ts', 'tests/index.ts')).toBe(false);
    });

    it('should match ** at start', () => {
      expect(matchGlob('**/*.md', 'README.md')).toBe(true);
      expect(matchGlob('**/*.md', 'docs/guide.md')).toBe(true);
      expect(matchGlob('**/*.md', 'docs/deep/nested.md')).toBe(true);
    });

    it('should match ? (single character)', () => {
      expect(matchGlob('src/?.ts', 'src/a.ts')).toBe(true);
      expect(matchGlob('src/?.ts', 'src/ab.ts')).toBe(false);
    });

    it('should escape regex special characters', () => {
      expect(matchGlob('file.test.ts', 'file.test.ts')).toBe(true);
      expect(matchGlob('file.test.ts', 'filextest.ts')).toBe(false);
    });

    it('should normalize backslashes', () => {
      expect(matchGlob('src/**/*.ts', 'src\\core\\loop.ts')).toBe(true);
    });

    it('should handle ** without trailing slash', () => {
      expect(matchGlob('src/**', 'src/anything')).toBe(true);
      expect(matchGlob('src/**', 'src/a/b/c')).toBe(true);
    });
  });

  describe('matchAnyGlob', () => {
    it('should match if any pattern matches', () => {
      expect(matchAnyGlob(['src/**/*.ts', 'tests/**/*.ts'], 'src/index.ts')).toBe(true);
      expect(matchAnyGlob(['src/**/*.ts', 'tests/**/*.ts'], 'tests/unit/foo.ts')).toBe(true);
      expect(matchAnyGlob(['src/**/*.ts', 'tests/**/*.ts'], 'docs/readme.md')).toBe(false);
    });

    it('should return false for empty patterns', () => {
      expect(matchAnyGlob([], 'anything')).toBe(false);
    });
  });

  describe('globToRegex', () => {
    it('should return a valid RegExp', () => {
      const re = globToRegex('src/**/*.ts');
      expect(re).toBeInstanceOf(RegExp);
    });
  });
});
