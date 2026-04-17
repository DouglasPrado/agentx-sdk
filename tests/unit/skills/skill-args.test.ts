import { describe, it, expect } from 'vitest';
import { substituteArgs, splitArgs } from '../../../src/skills/skill-args.js';

describe('skill-args', () => {
  describe('splitArgs', () => {
    it('should split simple space-separated args', () => {
      expect(splitArgs('file.ts production')).toEqual(['file.ts', 'production']);
    });

    it('should handle quoted strings', () => {
      expect(splitArgs('"hello world" foo')).toEqual(['hello world', 'foo']);
      expect(splitArgs("'hello world' foo")).toEqual(['hello world', 'foo']);
    });

    it('should handle empty string', () => {
      expect(splitArgs('')).toEqual([]);
    });

    it('should handle multiple spaces', () => {
      expect(splitArgs('a   b   c')).toEqual(['a', 'b', 'c']);
    });

    it('should handle tabs', () => {
      expect(splitArgs("a\tb")).toEqual(['a', 'b']);
    });
  });

  describe('substituteArgs', () => {
    it('should substitute named positional arguments', () => {
      const result = substituteArgs(
        'Review $file in $env mode',
        'app.ts production',
        ['file', 'env'],
      );
      expect(result).toBe('Review app.ts in production mode');
    });

    it('should leave unmatched named args empty', () => {
      const result = substituteArgs(
        'Review $file in $env mode',
        'app.ts',
        ['file', 'env'],
      );
      expect(result).toBe('Review app.ts in  mode');
    });

    it('should not replace partial name matches', () => {
      const result = substituteArgs(
        '$fileName is not $file',
        'test.ts',
        ['file'],
      );
      expect(result).toBe('$fileName is not test.ts');
    });

    it('should substitute ${VARIABLE} placeholders', () => {
      const result = substituteArgs(
        'Dir: ${SKILL_DIR}, Thread: ${THREAD_ID}',
        '',
        undefined,
        { SKILL_DIR: '/skills/review', THREAD_ID: 'thread-1' },
      );
      expect(result).toBe('Dir: /skills/review, Thread: thread-1');
    });

    it('should leave unknown ${VARIABLE} as-is', () => {
      const result = substituteArgs(
        'Unknown: ${MISSING}',
        '',
        undefined,
        { SKILL_DIR: '/path' },
      );
      expect(result).toBe('Unknown: ${MISSING}');
    });

    it('should combine args and variables', () => {
      const result = substituteArgs(
        'Review $file at ${SKILL_DIR}',
        'main.ts',
        ['file'],
        { SKILL_DIR: '/skills' },
      );
      expect(result).toBe('Review main.ts at /skills');
    });

    it('should handle $ARGS for remaining arguments', () => {
      const result = substituteArgs(
        'First: $file, Rest: $ARGS',
        'a.ts b.ts c.ts',
        ['file'],
      );
      expect(result).toBe('First: a.ts, Rest: b.ts c.ts');
    });

    it('should handle no args and no variables gracefully', () => {
      const result = substituteArgs('Plain text', '', undefined, undefined);
      expect(result).toBe('Plain text');
    });

    it('should replace multiple occurrences of same arg', () => {
      const result = substituteArgs(
        '$file and $file again',
        'test.ts',
        ['file'],
      );
      expect(result).toBe('test.ts and test.ts again');
    });

    it('treats replacement special chars in named args as literals', () => {
      const result = substituteArgs('Result: $x', '$&', ['x']);
      expect(result).toBe('Result: $&');
    });

    it('treats replacement special chars in $ARGS as literals', () => {
      const result = substituteArgs('Result: $ARGS', 'name extra $& tokens', ['first']);
      expect(result).toContain('$&');
    });

    it('treats replacement special chars in ${VAR} substitution as literals', () => {
      const result = substituteArgs('Use ${X}', '', [], { X: '$&$1' });
      expect(result).toBe('Use $&$1');
    });
  });
});
