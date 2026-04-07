import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  memoryAgeDays,
  memoryAge,
  memoryFreshnessText,
  memoryFreshnessNote,
} from '../../../src/memory/memory-age.js';

describe('memory-age', () => {
  describe('memoryAgeDays', () => {
    it('should return 0 for current timestamp', () => {
      expect(memoryAgeDays(Date.now())).toBe(0);
    });

    it('should return 1 for yesterday', () => {
      const yesterday = Date.now() - 86_400_000;
      expect(memoryAgeDays(yesterday)).toBe(1);
    });

    it('should return correct days for older timestamps', () => {
      const fiveDaysAgo = Date.now() - 5 * 86_400_000;
      expect(memoryAgeDays(fiveDaysAgo)).toBe(5);
    });

    it('should clamp negative values to 0', () => {
      const future = Date.now() + 86_400_000;
      expect(memoryAgeDays(future)).toBe(0);
    });
  });

  describe('memoryAge', () => {
    it('should return "today" for current timestamp', () => {
      expect(memoryAge(Date.now())).toBe('today');
    });

    it('should return "yesterday" for 1 day ago', () => {
      const yesterday = Date.now() - 86_400_000;
      expect(memoryAge(yesterday)).toBe('yesterday');
    });

    it('should return "N days ago" for older', () => {
      const threeDaysAgo = Date.now() - 3 * 86_400_000;
      expect(memoryAge(threeDaysAgo)).toBe('3 days ago');
    });
  });

  describe('memoryFreshnessText', () => {
    it('should return empty string for today', () => {
      expect(memoryFreshnessText(Date.now())).toBe('');
    });

    it('should return empty string for yesterday', () => {
      expect(memoryFreshnessText(Date.now() - 86_400_000)).toBe('');
    });

    it('should return staleness warning for older memories', () => {
      const fiveDaysAgo = Date.now() - 5 * 86_400_000;
      const text = memoryFreshnessText(fiveDaysAgo);
      expect(text).toContain('5 days old');
      expect(text).toContain('point-in-time');
      expect(text).toContain('Verify');
    });
  });

  describe('memoryFreshnessNote', () => {
    it('should return empty string for fresh memories', () => {
      expect(memoryFreshnessNote(Date.now())).toBe('');
    });

    it('should wrap staleness text for old memories', () => {
      const tenDaysAgo = Date.now() - 10 * 86_400_000;
      const note = memoryFreshnessNote(tenDaysAgo);
      expect(note).toContain('[staleness warning]');
      expect(note).toContain('10 days old');
      expect(note.endsWith('\n')).toBe(true);
    });
  });
});
