/**
 * Background memory extraction service.
 *
 * Analyzes recent conversation to extract memories worth saving.
 * Fire-and-forget — called after each completed turn.
 *
 * Key behaviors ported from old_src/services/extractMemories/:
 * - Pre-injects manifest of existing memories to avoid duplicates
 * - Uses comprehensive extraction prompt with type taxonomy
 * - Constrains extractor to only use recent messages (no investigation)
 */

import type { OpenRouterClient } from '../llm/openrouter-client.js';
import type { FileMemorySystem } from './file-memory-system.js';
import type { MemoryType } from './memory-types.js';
import { MEMORY_TYPES } from './memory-types.js';
import { formatMemoryManifest } from './memory-scanner.js';
import { buildExtractionPrompt } from './memory-prompts.js';

/** Extraction trigger keywords (multilingual) */
const EXPLICIT_TRIGGERS = [
  'remember that',
  'memorize',
  'lembra que',
  'lembre',
  'não esqueça',
  'keep in mind',
  'note that',
  'for future reference',
];

/**
 * Check if a message contains explicit memory save triggers.
 */
export function hasExplicitTrigger(message: string): boolean {
  const lower = message.toLowerCase();
  return EXPLICIT_TRIGGERS.some(t => lower.includes(t));
}

/**
 * Determine if extraction should run based on triggers.
 * - Explicit keyword → always extract
 * - Turn interval → extract every N turns
 * - Random sampling → probabilistic extraction
 */
export function shouldExtract(
  lastMessage: string,
  turnsSinceExtraction: number,
  config: { samplingRate?: number; extractionInterval?: number },
): boolean {
  if (hasExplicitTrigger(lastMessage)) return true;
  if (turnsSinceExtraction >= (config.extractionInterval ?? 10)) return true;
  if (Math.random() < (config.samplingRate ?? 0.3)) return true;
  return false;
}

interface ExtractedMemory {
  name: string;
  description: string;
  type: MemoryType;
  content: string;
}

/**
 * Extract memories from conversation text and save them.
 *
 * Pre-scans the memory directory and injects the existing manifest into
 * the extraction prompt so the LLM knows what already exists and can
 * update rather than duplicate.
 *
 * Fire-and-forget — errors are swallowed.
 */
export async function extractMemories(
  conversationText: string,
  memorySystem: FileMemorySystem,
  client: OpenRouterClient,
  options?: { model?: string; threadId?: string },
): Promise<string[]> {
  if (!conversationText.trim()) return [];

  try {
    // Pre-scan existing memories (thread + global) to avoid duplicates
    const existingMemories = await memorySystem.scanMemories(undefined, options?.threadId);
    const existingManifest = formatMemoryManifest(existingMemories);

    // Count approximate messages for the prompt
    const messageCount = conversationText.split('\n').filter(l => l.match(/^(user|assistant|tool):/)).length;

    const systemPrompt = buildExtractionPrompt(
      Math.max(messageCount, 2),
      existingManifest,
    );

    const response = await client.chat({
      model: options?.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: conversationText },
      ],
      temperature: 0,
      maxTokens: 16000,
    });

    let extracted: ExtractedMemory[];
    try {
      const jsonStr = response.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      extracted = JSON.parse(jsonStr);
    } catch {
      return [];
    }

    if (!Array.isArray(extracted)) return [];

    const saved: string[] = [];
    for (const item of extracted) {
      if (!item.name || !item.content || !item.type) continue;
      if (!MEMORY_TYPES.includes(item.type as MemoryType)) continue;

      const filename = await memorySystem.saveMemory({
        name: item.name,
        description: item.description || item.name,
        type: item.type as MemoryType,
        content: item.content,
      }, options?.threadId);
      saved.push(filename);
    }

    return saved;
  } catch {
    return [];
  }
}
