import type { AgentEvent } from '../contracts/entities/agent-event.js';

/**
 * Async push/pull channel with bounded queue and backpressure for AgentEvents.
 */
export class StreamEmitter {
  private readonly queue: AgentEvent[] = [];
  private readonly maxQueueSize: number;
  private resolve: ((value: IteratorResult<AgentEvent>) => void) | null = null;
  private done = false;

  constructor(maxQueueSize = 1000) {
    this.maxQueueSize = maxQueueSize;
  }

  /**
   * Push an event into the channel.
   */
  emit(event: AgentEvent): void {
    if (this.done) return;

    if (this.resolve) {
      // Consumer is waiting — deliver directly
      const r = this.resolve;
      this.resolve = null;
      r({ value: event, done: false });
    } else if (this.queue.length < this.maxQueueSize) {
      this.queue.push(event);
    }
    // If queue is full, drop event (backpressure)
  }

  /**
   * Close the channel — no more events will be emitted.
   */
  close(): void {
    this.done = true;
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r({ value: undefined, done: true });
    }
  }

  /**
   * Returns an AsyncIterableIterator for consuming events.
   */
  iterator(): AsyncIterableIterator<AgentEvent> {
    const next = (): Promise<IteratorResult<AgentEvent>> => {
      // Drain queue first
      if (this.queue.length > 0) {
        return Promise.resolve({ value: this.queue.shift()!, done: false });
      }

      if (this.done) {
        return Promise.resolve({ value: undefined as unknown as AgentEvent, done: true });
      }

      // Wait for next emit
      return new Promise((resolve) => {
        this.resolve = resolve;
      });
    };

    const iter: AsyncIterableIterator<AgentEvent> = {
      next,
      [Symbol.asyncIterator]: () => iter,
    };
    return iter;
  }
}
