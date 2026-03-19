import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DLQEntry {
  id: string;
  jobData: any;
  error: { message: string; stack?: string };
  queue?: string;
  capturedAt: string;
  retryCount: number;
}

const DLQ_TTL_MS = 604800000; // 7 days in ms
const DLQ_TTL_SECONDS = 604800; // 7 days in seconds
const DLQ_PREFIX = 'dlq:msg:';

@Injectable()
export class DeadLetterQueueService implements OnModuleInit {
  private readonly logger = new Logger(DeadLetterQueueService.name);
  private client: any = null;
  private useRedis = false;

  // In-memory fallback
  private memoryStore = new Map<string, { entry: DLQEntry; expiresAt: number }>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(private config: ConfigService) {
    this.cleanupTimer = setInterval(() => this.cleanupMemory(), 60 * 1000);
    this.cleanupTimer.unref();
  }

  async onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.log('No REDIS_URL — DLQ using in-memory store');
      return;
    }

    try {
      const { createClient } = await import('redis');
      this.client = createClient({ url: redisUrl });
      this.client.on('error', (err: any) => {
        this.logger.warn(`Redis error, falling back to memory: ${err.message}`);
        this.useRedis = false;
      });
      await this.client.connect();
      this.useRedis = true;
      this.logger.log('DLQ Redis store connected');
    } catch (err: any) {
      this.logger.warn(`Failed to connect Redis: ${err.message} — DLQ using in-memory fallback`);
    }
  }

  async capture(jobData: any, error: Error, queue?: string): Promise<string> {
    const id = this.generateId();
    const entry: DLQEntry = {
      id,
      jobData,
      error: { message: error.message, stack: error.stack },
      queue,
      capturedAt: new Date().toISOString(),
      retryCount: 0,
    };

    if (this.useRedis && this.client) {
      try {
        await this.client.set(`${DLQ_PREFIX}${id}`, JSON.stringify(entry), { EX: DLQ_TTL_SECONDS });
        return id;
      } catch {
        this.logger.warn('Redis SET failed for DLQ capture, falling back to memory');
      }
    }

    this.memoryStore.set(id, {
      entry,
      expiresAt: Date.now() + DLQ_TTL_MS,
    });

    return id;
  }

  async list(filters?: {
    queue?: string;
    since?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: DLQEntry[]; total: number }> {
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    let allEntries: DLQEntry[] = [];

    if (this.useRedis && this.client) {
      try {
        const keys = await this.scanKeys(`${DLQ_PREFIX}*`);
        const entries: DLQEntry[] = [];
        for (const key of keys) {
          const raw = await this.client.get(key);
          if (raw) {
            try {
              entries.push(JSON.parse(raw));
            } catch {
              // skip malformed entries
            }
          }
        }
        allEntries = entries;
      } catch {
        this.logger.warn('Redis SCAN failed for DLQ list, falling back to memory');
        allEntries = this.getMemoryEntries();
      }
    } else {
      allEntries = this.getMemoryEntries();
    }

    // Apply filters
    if (filters?.queue) {
      allEntries = allEntries.filter((e) => e.queue === filters.queue);
    }
    if (filters?.since) {
      const sinceTime = filters.since.getTime();
      allEntries = allEntries.filter((e) => new Date(e.capturedAt).getTime() >= sinceTime);
    }

    // Sort by capturedAt descending (newest first)
    allEntries.sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());

    const total = allEntries.length;
    const entries = allEntries.slice(offset, offset + limit);

    return { entries, total };
  }

  async get(id: string): Promise<DLQEntry | null> {
    if (this.useRedis && this.client) {
      try {
        const raw = await this.client.get(`${DLQ_PREFIX}${id}`);
        if (raw) {
          return JSON.parse(raw);
        }
        return null;
      } catch {
        this.logger.warn('Redis GET failed for DLQ, falling back to memory');
      }
    }

    const stored = this.memoryStore.get(id);
    if (!stored) return null;
    if (Date.now() > stored.expiresAt) {
      this.memoryStore.delete(id);
      return null;
    }
    return stored.entry;
  }

  async retry(id: string): Promise<boolean> {
    if (this.useRedis && this.client) {
      try {
        const deleted = await this.client.del(`${DLQ_PREFIX}${id}`);
        return deleted === 1;
      } catch {
        this.logger.warn('Redis DEL failed for DLQ retry, falling back to memory');
      }
    }

    return this.memoryStore.delete(id);
  }

  async purge(filters?: { queue?: string; before?: Date }): Promise<number> {
    let count = 0;

    if (this.useRedis && this.client) {
      try {
        const keys = await this.scanKeys(`${DLQ_PREFIX}*`);
        for (const key of keys) {
          if (!filters?.queue && !filters?.before) {
            await this.client.del(key);
            count++;
            continue;
          }

          const raw = await this.client.get(key);
          if (!raw) continue;

          try {
            const entry: DLQEntry = JSON.parse(raw);
            if (this.matchesPurgeFilters(entry, filters)) {
              await this.client.del(key);
              count++;
            }
          } catch {
            // skip malformed
          }
        }
        return count;
      } catch {
        this.logger.warn('Redis purge failed, falling back to memory');
      }
    }

    const now = Date.now();
    for (const [id, stored] of this.memoryStore) {
      if (now > stored.expiresAt) {
        this.memoryStore.delete(id);
        continue;
      }
      if (!filters?.queue && !filters?.before) {
        this.memoryStore.delete(id);
        count++;
      } else if (this.matchesPurgeFilters(stored.entry, filters)) {
        this.memoryStore.delete(id);
        count++;
      }
    }

    return count;
  }

  async getStats(): Promise<{ total: number; byQueue: Record<string, number> }> {
    const { entries } = await this.list({ limit: 100000 });

    const byQueue: Record<string, number> = {};
    for (const entry of entries) {
      const queueName = entry.queue || 'unknown';
      byQueue[queueName] = (byQueue[queueName] || 0) + 1;
    }

    return { total: entries.length, byQueue };
  }

  /** Clear all in-memory entries — for tests */
  clearMemory() {
    this.memoryStore.clear();
  }

  isRedisConnected(): boolean {
    return this.useRedis;
  }

  private matchesPurgeFilters(
    entry: DLQEntry,
    filters?: { queue?: string; before?: Date },
  ): boolean {
    if (filters?.queue && entry.queue !== filters.queue) return false;
    if (filters?.before) {
      const capturedTime = new Date(entry.capturedAt).getTime();
      if (capturedTime >= filters.before.getTime()) return false;
    }
    return true;
  }

  private getMemoryEntries(): DLQEntry[] {
    const now = Date.now();
    const entries: DLQEntry[] = [];
    for (const [id, stored] of this.memoryStore) {
      if (now > stored.expiresAt) {
        this.memoryStore.delete(id);
      } else {
        entries.push(stored.entry);
      }
    }
    return entries;
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = 0;
    do {
      const result = await this.client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;
      keys.push(...result.keys);
    } while (cursor !== 0);
    return keys;
  }

  private generateId(): string {
    // Simple unique ID generation without external dependency
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `dlq_${timestamp}${random}`;
  }

  private cleanupMemory() {
    const now = Date.now();
    for (const [id, stored] of this.memoryStore) {
      if (now > stored.expiresAt) this.memoryStore.delete(id);
    }
  }
}
