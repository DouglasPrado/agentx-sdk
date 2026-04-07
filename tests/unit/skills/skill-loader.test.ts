import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseSkillFrontmatter,
  extractBody,
  loadSkillFile,
  scanSkillFiles,
} from '../../../src/skills/skill-loader.js';

describe('skill-loader', () => {
  describe('parseSkillFrontmatter', () => {
    it('should parse basic frontmatter', () => {
      const content = `---
name: code-review
description: Reviews code
triggerPrefix: /review
priority: 5
---

Body content`;

      const fm = parseSkillFrontmatter(content);
      expect(fm.name).toBe('code-review');
      expect(fm.description).toBe('Reviews code');
      expect(fm.triggerPrefix).toBe('/review');
      expect(fm.priority).toBe(5);
    });

    it('should parse arrays', () => {
      const content = `---
aliases: [review, cr, audit]
argNames: [file, env]
paths: [src/**/*.ts, tests/**/*.ts]
---
`;
      const fm = parseSkillFrontmatter(content);
      expect(fm.aliases).toEqual(['review', 'cr', 'audit']);
      expect(fm.argNames).toEqual(['file', 'env']);
      expect(fm.paths).toEqual(['src/**/*.ts', 'tests/**/*.ts']);
    });

    it('should parse booleans', () => {
      const content = `---
exclusive: true
modelInvocable: false
---
`;
      const fm = parseSkillFrontmatter(content);
      expect(fm.exclusive).toBe(true);
      expect(fm.modelInvocable).toBe(false);
    });

    it('should handle kebab-case keys', () => {
      const content = `---
when-to-use: When reviewing code
trigger-prefix: /review
allowed-tools: [Read, Grep]
---
`;
      const fm = parseSkillFrontmatter(content);
      expect(fm.whenToUse).toBe('When reviewing code');
      expect(fm.triggerPrefix).toBe('/review');
      expect(fm.allowedTools).toEqual(['Read', 'Grep']);
    });

    it('should return empty object for no frontmatter', () => {
      const fm = parseSkillFrontmatter('Just plain text');
      expect(fm).toEqual({});
    });

    it('should parse context field', () => {
      const content = `---
context: inline
---
`;
      const fm = parseSkillFrontmatter(content);
      expect(fm.context).toBe('inline');
    });

    it('should ignore invalid context values', () => {
      const content = `---
context: invalid
---
`;
      const fm = parseSkillFrontmatter(content);
      expect(fm.context).toBeUndefined();
    });

    it('should handle quoted values', () => {
      const content = `---
name: "my skill"
description: 'A great skill'
---
`;
      const fm = parseSkillFrontmatter(content);
      expect(fm.name).toBe('my skill');
      expect(fm.description).toBe('A great skill');
    });
  });

  describe('extractBody', () => {
    it('should extract body after frontmatter', () => {
      const content = `---
name: test
---

Body content here`;

      expect(extractBody(content)).toBe('Body content here');
    });

    it('should return full content if no frontmatter', () => {
      expect(extractBody('Just text')).toBe('Just text');
    });

    it('should handle empty body', () => {
      const content = `---
name: test
---
`;
      expect(extractBody(content)).toBe('');
    });
  });

  describe('loadSkillFile', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'skill-loader-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should load a valid skill file', async () => {
      const skillDir = join(tempDir, 'review');
      await mkdir(skillDir);
      await writeFile(join(skillDir, 'SKILL.md'), `---
name: code-review
description: Reviews code for quality
triggerPrefix: /review
priority: 8
---

You are in code review mode.
Analyze the code carefully.`);

      const skill = await loadSkillFile(join(skillDir, 'SKILL.md'));
      expect(skill).not.toBeNull();
      expect(skill!.name).toBe('code-review');
      expect(skill!.description).toBe('Reviews code for quality');
      expect(skill!.triggerPrefix).toBe('/review');
      expect(skill!.priority).toBe(8);
      expect(skill!.instructions).toContain('code review mode');
      expect(skill!.source).toBe('directory');
      expect(skill!.skillDir).toBe(skillDir);
    });

    it('should use directory name as fallback name', async () => {
      const skillDir = join(tempDir, 'my-cool-skill');
      await mkdir(skillDir);
      await writeFile(join(skillDir, 'SKILL.md'), `---
description: A cool skill
---

Instructions here`);

      const skill = await loadSkillFile(join(skillDir, 'SKILL.md'));
      expect(skill!.name).toBe('my-cool-skill');
    });

    it('should create getPrompt for skills with argNames', async () => {
      const skillDir = join(tempDir, 'review');
      await mkdir(skillDir);
      await writeFile(join(skillDir, 'SKILL.md'), `---
name: review
description: Review a file
argNames: [file]
---

Review $file carefully.`);

      const skill = await loadSkillFile(join(skillDir, 'SKILL.md'));
      expect(skill!.getPrompt).toBeDefined();

      const prompt = await skill!.getPrompt!('main.ts', {
        threadId: 't1',
        traceId: 'tr1',
        skillDir,
      });
      expect(prompt).toBe('Review main.ts carefully.');
    });

    it('should return null for non-existent file', async () => {
      const skill = await loadSkillFile(join(tempDir, 'nope', 'SKILL.md'));
      expect(skill).toBeNull();
    });

    it('should return null for empty file', async () => {
      const skillDir = join(tempDir, 'empty');
      await mkdir(skillDir);
      await writeFile(join(skillDir, 'SKILL.md'), '');

      const skill = await loadSkillFile(join(skillDir, 'SKILL.md'));
      expect(skill).toBeNull();
    });
  });

  describe('scanSkillFiles', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'skill-scan-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should scan subdirectory layout', async () => {
      const reviewDir = join(tempDir, 'review');
      const translateDir = join(tempDir, 'translate');
      await mkdir(reviewDir);
      await mkdir(translateDir);

      await writeFile(join(reviewDir, 'SKILL.md'), `---
name: review
description: Code review
---
Review code`);

      await writeFile(join(translateDir, 'SKILL.md'), `---
name: translate
description: Translate text
---
Translate`);

      const skills = await scanSkillFiles(tempDir);
      expect(skills).toHaveLength(2);
      expect(skills.map(s => s.name).sort()).toEqual(['review', 'translate']);
    });

    it('should scan flat .md files', async () => {
      await writeFile(join(tempDir, 'review.md'), `---
name: review
description: Code review
---
Review code`);

      const skills = await scanSkillFiles(tempDir);
      expect(skills).toHaveLength(1);
      expect(skills[0]!.name).toBe('review');
    });

    it('should skip README.md', async () => {
      await writeFile(join(tempDir, 'README.md'), '# Skills\nDocumentation');
      const skills = await scanSkillFiles(tempDir);
      expect(skills).toHaveLength(0);
    });

    it('should return empty array for non-existent directory', async () => {
      const skills = await scanSkillFiles(join(tempDir, 'nope'));
      expect(skills).toEqual([]);
    });

    it('should handle mixed layouts', async () => {
      // Subdirectory
      const reviewDir = join(tempDir, 'review');
      await mkdir(reviewDir);
      await writeFile(join(reviewDir, 'SKILL.md'), `---
name: review
description: Code review
---
Review`);

      // Flat file
      await writeFile(join(tempDir, 'translate.md'), `---
name: translate
description: Translate
---
Translate`);

      const skills = await scanSkillFiles(tempDir);
      expect(skills).toHaveLength(2);
    });
  });
});
