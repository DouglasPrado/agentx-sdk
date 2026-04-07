import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  hasExplicitTrigger,
  shouldExtract,
  extractMemories,
} from '../../../src/memory/memory-extractor.js';
import { FileMemorySystem } from '../../../src/memory/file-memory-system.js';
import type { OpenRouterClient } from '../../../src/llm/openrouter-client.js';
import type { Logger } from '../../../src/utils/logger.js';

function createMockClient(response: string): OpenRouterClient {
  return {
    chat: vi.fn().mockResolvedValue({ content: response }),
  } as unknown as OpenRouterClient;
}

function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger;
}

describe('memory-extractor', () => {
  describe('hasExplicitTrigger', () => {
    it('should detect English triggers', () => {
      expect(hasExplicitTrigger('Please remember that I like dark mode')).toBe(true);
      expect(hasExplicitTrigger('Keep in mind I use vim')).toBe(true);
      expect(hasExplicitTrigger('For future reference, the API key is X')).toBe(true);
    });

    it('should detect Portuguese triggers', () => {
      expect(hasExplicitTrigger('Lembra que eu gosto de TypeScript')).toBe(true);
      expect(hasExplicitTrigger('Não esqueça de usar testes')).toBe(true);
    });

    it('should return false for normal messages', () => {
      expect(hasExplicitTrigger('How do I fix this bug?')).toBe(false);
      expect(hasExplicitTrigger('Write a function')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(hasExplicitTrigger('REMEMBER THAT I prefer tabs')).toBe(true);
    });
  });

  describe('shouldExtract', () => {
    it('should return true on explicit trigger', () => {
      expect(shouldExtract('remember that I use vim', 0, {})).toBe(true);
    });

    it('should return true when turn interval exceeded', () => {
      expect(shouldExtract('normal message', 10, { extractionInterval: 10 })).toBe(true);
    });

    it('should return false when interval not reached and no trigger', () => {
      expect(shouldExtract('normal message', 2, { samplingRate: 0 })).toBe(false);
    });
  });

  describe('extractMemories', () => {
    let tempDir: string;
    let system: FileMemorySystem;
    let logger: Logger;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'extract-test-'));
      logger = createMockLogger();
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should extract and save memories from conversation', async () => {
      const extractedData = [
        {
          name: 'User Expertise',
          description: 'User is a Go developer',
          type: 'user',
          content: 'The user has 10 years of Go experience.',
        },
      ];
      const client = createMockClient(JSON.stringify(extractedData));
      system = new FileMemorySystem({ memoryDir: tempDir }, client, logger);

      const saved = await extractMemories(
        'user: I have been writing Go for 10 years\nassistant: Great!',
        system,
        client,
      );

      expect(saved).toHaveLength(1);
      expect(saved[0]).toBe('user-expertise.md');

      const content = await readFile(join(tempDir, 'user-expertise.md'), 'utf-8');
      expect(content).toContain('10 years of Go experience');
    });

    it('should return empty array on empty conversation', async () => {
      const client = createMockClient('[]');
      system = new FileMemorySystem({ memoryDir: tempDir }, client, logger);

      const saved = await extractMemories('', system, client);
      expect(saved).toEqual([]);
    });

    it('should handle invalid JSON response gracefully', async () => {
      const client = createMockClient('not json at all');
      system = new FileMemorySystem({ memoryDir: tempDir }, client, logger);

      const saved = await extractMemories('some conversation', system, client);
      expect(saved).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      const client = {
        chat: vi.fn().mockRejectedValue(new Error('API error')),
      } as unknown as OpenRouterClient;
      system = new FileMemorySystem({ memoryDir: tempDir }, client, logger);

      const saved = await extractMemories('some conversation', system, client);
      expect(saved).toEqual([]);
    });

    it('should skip items with invalid type', async () => {
      const extractedData = [
        { name: 'Bad', description: 'bad', type: 'unknown', content: 'content' },
        { name: 'Good', description: 'good', type: 'user', content: 'content' },
      ];
      const client = createMockClient(JSON.stringify(extractedData));
      system = new FileMemorySystem({ memoryDir: tempDir }, client, logger);

      const saved = await extractMemories('conversation', system, client);
      expect(saved).toHaveLength(1);
      expect(saved[0]).toBe('good.md');
    });

    it('should skip items missing required fields', async () => {
      const extractedData = [
        { name: 'No Content', description: 'test', type: 'user' },
        { description: 'No Name', type: 'user', content: 'content' },
      ];
      const client = createMockClient(JSON.stringify(extractedData));
      system = new FileMemorySystem({ memoryDir: tempDir }, client, logger);

      const saved = await extractMemories('conversation', system, client);
      expect(saved).toEqual([]);
    });

    it('should handle markdown-wrapped JSON response', async () => {
      const wrapped = '```json\n[{"name":"Test","description":"test","type":"feedback","content":"content"}]\n```';
      const client = createMockClient(wrapped);
      system = new FileMemorySystem({ memoryDir: tempDir }, client, logger);

      const saved = await extractMemories('conversation', system, client);
      expect(saved).toHaveLength(1);
    });
  });
});
