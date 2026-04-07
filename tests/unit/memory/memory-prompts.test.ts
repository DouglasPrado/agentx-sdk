import { describe, it, expect } from 'vitest';
import {
  buildMemoryInstructions,
  buildExtractionPrompt,
  TYPES_SECTION,
  WHAT_NOT_TO_SAVE_SECTION,
  WHEN_TO_ACCESS_SECTION,
  TRUSTING_RECALL_SECTION,
  PERSISTENCE_SECTION,
  MEMORY_FRONTMATTER_EXAMPLE,
  buildHowToSaveSection,
} from '../../../src/memory/memory-prompts.js';

describe('memory-prompts', () => {
  describe('buildMemoryInstructions', () => {
    const instructions = buildMemoryInstructions('/test/memory/');

    it('should include memory directory path', () => {
      expect(instructions).toContain('/test/memory/');
    });

    it('should include dir-exists guidance', () => {
      expect(instructions).toContain('already exists');
      expect(instructions).toContain('do not run mkdir');
    });

    it('should include build-up guidance', () => {
      expect(instructions).toContain('build up this memory system over time');
    });

    it('should include save/forget instructions', () => {
      expect(instructions).toContain('remember something, save it immediately');
      expect(instructions).toContain('forget something, find and remove');
    });

    it('should include all 4 memory types', () => {
      expect(instructions).toContain('<name>user</name>');
      expect(instructions).toContain('<name>feedback</name>');
      expect(instructions).toContain('<name>project</name>');
      expect(instructions).toContain('<name>reference</name>');
    });

    it('should include when_to_save for each type', () => {
      expect(instructions).toContain('<when_to_save>');
    });

    it('should include how_to_use for each type', () => {
      expect(instructions).toContain('<how_to_use>');
    });

    it('should include body_structure for feedback', () => {
      expect(instructions).toContain('<body_structure>');
      expect(instructions).toContain('**Why:**');
      expect(instructions).toContain('**How to apply:**');
    });

    it('should include what NOT to save', () => {
      expect(instructions).toContain('What NOT to save');
      expect(instructions).toContain('Code patterns');
      expect(instructions).toContain('Git history');
      expect(instructions).toContain('Debugging solutions');
      expect(instructions).toContain('even when the user explicitly asks');
    });

    it('should include when to access', () => {
      expect(instructions).toContain('When to access memories');
      expect(instructions).toContain('ignore');
      expect(instructions).toContain('proceed as if MEMORY.md were empty');
    });

    it('should include drift caveat', () => {
      expect(instructions).toContain('stale over time');
      expect(instructions).toContain('verify that the memory is still correct');
    });

    it('should include trusting recall section', () => {
      expect(instructions).toContain('Before recommending from memory');
      expect(instructions).toContain('check the file exists');
      expect(instructions).toContain('grep for it');
      expect(instructions).toContain('"The memory says X exists" is not the same as "X exists now."');
    });

    it('should include how to save (two-step)', () => {
      expect(instructions).toContain('Step 1');
      expect(instructions).toContain('Step 2');
      expect(instructions).toContain('MEMORY.md');
      expect(instructions).toContain('under ~150 characters');
    });

    it('should include persistence vs other mechanisms', () => {
      expect(instructions).toContain('Memory and other forms of persistence');
      expect(instructions).toContain('plan instead of memory');
      expect(instructions).toContain('tasks instead of memory');
    });
  });

  describe('buildExtractionPrompt', () => {
    it('should include message count', () => {
      const prompt = buildExtractionPrompt(6, '');
      expect(prompt).toContain('~6 messages');
    });

    it('should include constraint against investigation', () => {
      const prompt = buildExtractionPrompt(6, '');
      expect(prompt).toContain('Do not waste time investigating');
      expect(prompt).toContain('no grepping source files');
    });

    it('should include existing manifest when provided', () => {
      const manifest = '- [user] role.md: Senior dev';
      const prompt = buildExtractionPrompt(6, manifest);
      expect(prompt).toContain('Existing memory files');
      expect(prompt).toContain('Senior dev');
      expect(prompt).toContain('update an existing file rather than creating a duplicate');
    });

    it('should not include manifest section when empty', () => {
      const prompt = buildExtractionPrompt(6, '');
      expect(prompt).not.toContain('Existing memory files');
    });

    it('should include type taxonomy', () => {
      const prompt = buildExtractionPrompt(6, '');
      expect(prompt).toContain('<name>user</name>');
      expect(prompt).toContain('<name>feedback</name>');
    });

    it('should include what NOT to save', () => {
      const prompt = buildExtractionPrompt(6, '');
      expect(prompt).toContain('What NOT to save');
    });

    it('should request JSON format', () => {
      const prompt = buildExtractionPrompt(6, '');
      expect(prompt).toContain('JSON array');
      expect(prompt).toContain('"name"');
      expect(prompt).toContain('"type"');
    });
  });

  describe('constants', () => {
    it('TYPES_SECTION should have all 4 types', () => {
      const text = TYPES_SECTION.join('\n');
      expect(text).toContain('user');
      expect(text).toContain('feedback');
      expect(text).toContain('project');
      expect(text).toContain('reference');
    });

    it('WHAT_NOT_TO_SAVE_SECTION should list exclusions', () => {
      const text = WHAT_NOT_TO_SAVE_SECTION.join('\n');
      expect(text).toContain('Code patterns');
      expect(text).toContain('Git history');
    });

    it('WHEN_TO_ACCESS_SECTION should have access rules', () => {
      const text = WHEN_TO_ACCESS_SECTION.join('\n');
      expect(text).toContain('MUST access memory');
    });

    it('TRUSTING_RECALL_SECTION should have verification steps', () => {
      const text = TRUSTING_RECALL_SECTION.join('\n');
      expect(text).toContain('file path: check the file exists');
      expect(text).toContain('function or flag: grep');
    });

    it('MEMORY_FRONTMATTER_EXAMPLE should show format', () => {
      const text = MEMORY_FRONTMATTER_EXAMPLE.join('\n');
      expect(text).toContain('name:');
      expect(text).toContain('description:');
      expect(text).toContain('type:');
    });
  });
});
