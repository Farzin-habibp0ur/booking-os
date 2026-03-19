import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DeadLetterQueueService, DLQEntry } from './dead-letter.service';

describe('DeadLetterQueueService', () => {
  let service: DeadLetterQueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadLetterQueueService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined), // no REDIS_URL → in-memory
          },
        },
      ],
    }).compile();

    service = module.get<DeadLetterQueueService>(DeadLetterQueueService);
    await service.onModuleInit();
  });

  afterEach(() => {
    service.clearMemory();
  });

  describe('capture', () => {
    it('captures a job and returns an id', async () => {
      const id = await service.capture(
        { type: 'send-email', to: 'test@test.com' },
        new Error('SMTP timeout'),
        'messaging',
      );

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.startsWith('dlq_')).toBe(true);
    });

    it('stores the full error details', async () => {
      const error = new Error('Connection refused');
      const id = await service.capture({ foo: 'bar' }, error, 'notifications');

      const entry = await service.get(id);
      expect(entry).not.toBeNull();
      expect(entry!.error.message).toBe('Connection refused');
      expect(entry!.error.stack).toBeDefined();
    });

    it('stores the queue name', async () => {
      const id = await service.capture({ x: 1 }, new Error('fail'), 'ai-processing');

      const entry = await service.get(id);
      expect(entry!.queue).toBe('ai-processing');
    });

    it('captures without a queue name', async () => {
      const id = await service.capture({ x: 1 }, new Error('fail'));

      const entry = await service.get(id);
      expect(entry!.queue).toBeUndefined();
    });

    it('sets capturedAt and retryCount to 0', async () => {
      const id = await service.capture({ x: 1 }, new Error('fail'), 'reminders');

      const entry = await service.get(id);
      expect(entry!.capturedAt).toBeDefined();
      expect(new Date(entry!.capturedAt).getTime()).toBeGreaterThan(0);
      expect(entry!.retryCount).toBe(0);
    });
  });

  describe('get', () => {
    it('returns null for non-existent id', async () => {
      const entry = await service.get('non-existent');
      expect(entry).toBeNull();
    });

    it('returns the captured entry', async () => {
      const jobData = { type: 'reminder', bookingId: 'bk-1' };
      const id = await service.capture(jobData, new Error('timeout'), 'reminders');

      const entry = await service.get(id);
      expect(entry).not.toBeNull();
      expect(entry!.id).toBe(id);
      expect(entry!.jobData).toEqual(jobData);
    });
  });

  describe('list', () => {
    it('returns empty list when no entries', async () => {
      const result = await service.list();
      expect(result.entries).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns all captured entries', async () => {
      await service.capture({ a: 1 }, new Error('e1'), 'q1');
      await service.capture({ b: 2 }, new Error('e2'), 'q2');
      await service.capture({ c: 3 }, new Error('e3'), 'q1');

      const result = await service.list();
      expect(result.total).toBe(3);
      expect(result.entries).toHaveLength(3);
    });

    it('filters by queue', async () => {
      await service.capture({ a: 1 }, new Error('e1'), 'messaging');
      await service.capture({ b: 2 }, new Error('e2'), 'reminders');
      await service.capture({ c: 3 }, new Error('e3'), 'messaging');

      const result = await service.list({ queue: 'messaging' });
      expect(result.total).toBe(2);
      expect(result.entries.every((e) => e.queue === 'messaging')).toBe(true);
    });

    it('filters by since date', async () => {
      const id1 = await service.capture({ a: 1 }, new Error('e1'), 'q1');

      // Manipulate capturedAt to be in the past
      const entry1 = await service.get(id1);
      const pastDate = new Date('2025-01-01T00:00:00Z');
      (entry1 as any).capturedAt = pastDate.toISOString();
      // Re-store with modified date (access internal store)
      (service as any).memoryStore.set(id1, {
        entry: entry1,
        expiresAt: Date.now() + 604800000,
      });

      await service.capture({ b: 2 }, new Error('e2'), 'q1');

      const result = await service.list({ since: new Date('2026-01-01') });
      expect(result.total).toBe(1);
    });

    it('respects limit and offset', async () => {
      await service.capture({ a: 1 }, new Error('e1'), 'q1');
      await service.capture({ b: 2 }, new Error('e2'), 'q1');
      await service.capture({ c: 3 }, new Error('e3'), 'q1');

      const result = await service.list({ limit: 2, offset: 0 });
      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(3);

      const result2 = await service.list({ limit: 2, offset: 2 });
      expect(result2.entries).toHaveLength(1);
      expect(result2.total).toBe(3);
    });

    it('sorts entries by capturedAt descending', async () => {
      await service.capture({ a: 1 }, new Error('e1'), 'q1');
      await service.capture({ b: 2 }, new Error('e2'), 'q1');

      const result = await service.list();
      const t1 = new Date(result.entries[0].capturedAt).getTime();
      const t2 = new Date(result.entries[1].capturedAt).getTime();
      expect(t1).toBeGreaterThanOrEqual(t2);
    });
  });

  describe('retry', () => {
    it('removes the entry and returns true', async () => {
      const id = await service.capture({ a: 1 }, new Error('e1'), 'q1');

      const result = await service.retry(id);
      expect(result).toBe(true);

      const entry = await service.get(id);
      expect(entry).toBeNull();
    });

    it('returns false for non-existent id', async () => {
      const result = await service.retry('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('purge', () => {
    it('removes all entries when no filters', async () => {
      await service.capture({ a: 1 }, new Error('e1'), 'q1');
      await service.capture({ b: 2 }, new Error('e2'), 'q2');

      const count = await service.purge();
      expect(count).toBe(2);

      const result = await service.list();
      expect(result.total).toBe(0);
    });

    it('purges only matching queue', async () => {
      await service.capture({ a: 1 }, new Error('e1'), 'messaging');
      await service.capture({ b: 2 }, new Error('e2'), 'reminders');

      const count = await service.purge({ queue: 'messaging' });
      expect(count).toBe(1);

      const result = await service.list();
      expect(result.total).toBe(1);
      expect(result.entries[0].queue).toBe('reminders');
    });

    it('purges entries before a given date', async () => {
      const id1 = await service.capture({ a: 1 }, new Error('e1'), 'q1');

      // Set one entry to be old
      const entry1 = await service.get(id1);
      (entry1 as any).capturedAt = '2025-01-01T00:00:00.000Z';
      (service as any).memoryStore.set(id1, {
        entry: entry1,
        expiresAt: Date.now() + 604800000,
      });

      await service.capture({ b: 2 }, new Error('e2'), 'q1');

      const count = await service.purge({ before: new Date('2026-01-01') });
      expect(count).toBe(1);
    });
  });

  describe('getStats', () => {
    it('returns zero totals when empty', async () => {
      const stats = await service.getStats();
      expect(stats.total).toBe(0);
      expect(stats.byQueue).toEqual({});
    });

    it('returns correct totals grouped by queue', async () => {
      await service.capture({ a: 1 }, new Error('e1'), 'messaging');
      await service.capture({ b: 2 }, new Error('e2'), 'messaging');
      await service.capture({ c: 3 }, new Error('e3'), 'reminders');

      const stats = await service.getStats();
      expect(stats.total).toBe(3);
      expect(stats.byQueue).toEqual({ messaging: 2, reminders: 1 });
    });

    it('uses "unknown" for entries without queue', async () => {
      await service.capture({ a: 1 }, new Error('e1'));

      const stats = await service.getStats();
      expect(stats.byQueue).toEqual({ unknown: 1 });
    });
  });

  describe('in-memory fallback', () => {
    it('uses in-memory store when Redis is not configured', () => {
      expect(service.isRedisConnected()).toBe(false);
    });

    it('full capture-list-get-retry cycle works in memory', async () => {
      const id = await service.capture({ type: 'test' }, new Error('test error'), 'test-queue');

      const listed = await service.list();
      expect(listed.total).toBe(1);

      const entry = await service.get(id);
      expect(entry!.jobData.type).toBe('test');

      const retried = await service.retry(id);
      expect(retried).toBe(true);

      const afterRetry = await service.list();
      expect(afterRetry.total).toBe(0);
    });
  });
});
