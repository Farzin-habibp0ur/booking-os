import { BadRequestException } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerMergeService } from './customer-merge.service';

describe('CustomerController', () => {
  let controller: CustomerController;
  let mockService: Record<string, jest.Mock>;
  let mockMergeService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findById: jest.fn().mockResolvedValue({ id: 'cust1', name: 'Emma' }),
      create: jest.fn().mockResolvedValue({ id: 'cust1' }),
      update: jest.fn().mockResolvedValue({ id: 'cust1' }),
      getBookings: jest.fn().mockResolvedValue([]),
      getNotes: jest.fn().mockResolvedValue([{ id: 'n1', content: 'Test note' }]),
      createNote: jest.fn().mockResolvedValue({ id: 'n1', content: 'New note' }),
      updateNote: jest.fn().mockResolvedValue({ id: 'n1', content: 'Updated' }),
      deleteNote: jest.fn().mockResolvedValue({ id: 'n1' }),
      getTimeline: jest.fn().mockResolvedValue({ events: [], total: 0, hasMore: false }),
      bulkUpdate: jest.fn().mockResolvedValue({ updated: 2 }),
      bulkCreate: jest.fn().mockResolvedValue({ created: 3, skipped: 0 }),
      createFromConversations: jest.fn().mockResolvedValue({ created: 5 }),
    };
    mockMergeService = {
      listDuplicates: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20 }),
      mergeDuplicateById: jest.fn().mockResolvedValue({ id: 'cust1', name: 'Merged' }),
      markNotDuplicateById: jest.fn().mockResolvedValue({ id: 'dc1', status: 'NOT_DUPLICATE' }),
      snoozeDuplicate: jest.fn().mockResolvedValue({ id: 'dc1', status: 'SNOOZED' }),
    };
    controller = new CustomerController(
      mockService as unknown as CustomerService,
      mockMergeService as unknown as CustomerMergeService,
    );
  });

  describe('list', () => {
    it('delegates to service with parsed query', async () => {
      await controller.list('biz1', { search: 'emma', page: '2', pageSize: '20' });
      expect(mockService.findAll).toHaveBeenCalledWith('biz1', {
        search: 'emma',
        page: 2,
        pageSize: 20,
      });
    });

    it('handles missing query params', async () => {
      await controller.list('biz1', {});
      expect(mockService.findAll).toHaveBeenCalledWith('biz1', {
        search: undefined,
        page: undefined,
        pageSize: undefined,
      });
    });
  });

  describe('detail', () => {
    it('returns customer by id', async () => {
      const result = await controller.detail('biz1', 'cust1');
      expect(mockService.findById).toHaveBeenCalledWith('biz1', 'cust1');
      expect(result).toEqual({ id: 'cust1', name: 'Emma' });
    });
  });

  describe('create', () => {
    it('creates a customer', async () => {
      const body = { name: 'Emma', phone: '+123' } as any;
      await controller.create('biz1', body);
      expect(mockService.create).toHaveBeenCalledWith('biz1', body);
    });
  });

  describe('update', () => {
    it('updates a customer', async () => {
      const body = { name: 'Emma Updated' } as any;
      await controller.update('biz1', 'cust1', body);
      expect(mockService.update).toHaveBeenCalledWith('biz1', 'cust1', body);
    });
  });

  describe('bookings', () => {
    it('returns customer bookings', async () => {
      await controller.bookings('biz1', 'cust1');
      expect(mockService.getBookings).toHaveBeenCalledWith('biz1', 'cust1');
    });
  });

  describe('getNotes', () => {
    it('delegates to service with businessId and customerId', async () => {
      const result = await controller.getNotes('biz1', 'cust1');
      expect(mockService.getNotes).toHaveBeenCalledWith('biz1', 'cust1');
      expect(result).toEqual([{ id: 'n1', content: 'Test note' }]);
    });
  });

  describe('createNote', () => {
    it('delegates to service with correct params', async () => {
      await controller.createNote('biz1', 'cust1', { content: 'New note' } as any, {
        id: 'staff1',
      });
      expect(mockService.createNote).toHaveBeenCalledWith('biz1', 'cust1', 'staff1', 'New note');
    });
  });

  describe('updateNote', () => {
    it('delegates to service with correct params', async () => {
      await controller.updateNote('biz1', 'cust1', 'n1', { content: 'Updated' } as any, {
        id: 'staff1',
      });
      expect(mockService.updateNote).toHaveBeenCalledWith('biz1', 'n1', 'staff1', 'Updated');
    });
  });

  describe('deleteNote', () => {
    it('delegates to service with correct params', async () => {
      await controller.deleteNote('biz1', 'cust1', 'n1', { id: 'staff1' });
      expect(mockService.deleteNote).toHaveBeenCalledWith('biz1', 'n1', 'staff1');
    });
  });

  describe('getTimeline', () => {
    it('delegates to service with default params', async () => {
      await controller.getTimeline('biz1', 'cust1');
      expect(mockService.getTimeline).toHaveBeenCalledWith('biz1', 'cust1', {
        types: undefined,
        showSystem: true,
        limit: undefined,
        offset: undefined,
      });
    });

    it('parses types and query params', async () => {
      await controller.getTimeline('biz1', 'cust1', 'booking,note', 'false', '10', '5');
      expect(mockService.getTimeline).toHaveBeenCalledWith('biz1', 'cust1', {
        types: ['booking', 'note'],
        showSystem: false,
        limit: 10,
        offset: 5,
      });
    });
  });

  describe('bulkAction', () => {
    it('delegates bulk tag action', async () => {
      await controller.bulkAction('biz1', {
        ids: ['c1', 'c2'],
        action: 'tag',
        payload: { tag: 'VIP' },
      });
      expect(mockService.bulkUpdate).toHaveBeenCalledWith('biz1', ['c1', 'c2'], 'tag', {
        tag: 'VIP',
      });
    });
  });

  describe('importCsv', () => {
    function createFile(content: string, size?: number, originalname = 'test.csv') {
      const buffer = Buffer.from(content);
      return {
        buffer,
        size: size ?? buffer.length,
        originalname,
      } as Express.Multer.File;
    }

    const validCsv = 'name,phone,email,tags\nEmma,+123,emma@test.com,VIP;returning';

    it('imports valid CSV', async () => {
      const result = await controller.importCsv('biz1', createFile(validCsv), { id: 'staff1' });
      expect(mockService.bulkCreate).toHaveBeenCalledWith('biz1', [
        { name: 'Emma', phone: '+123', email: 'emma@test.com', tags: ['VIP', 'returning'] },
      ]);
      expect(result).toEqual({ created: 3, skipped: 0 });
    });

    it('throws when no file uploaded', async () => {
      await expect(controller.importCsv('biz1', undefined as any, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when file exceeds 2MB', async () => {
      const file = createFile('data', 3 * 1024 * 1024);
      await expect(controller.importCsv('biz1', file, {})).rejects.toThrow('under 2MB');
    });

    it('throws when CSV has no data rows', async () => {
      const file = createFile('name,phone');
      await expect(controller.importCsv('biz1', file, {})).rejects.toThrow(
        'header and at least one data row',
      );
    });

    it('throws when CSV exceeds 5000 rows', async () => {
      const lines = ['name,phone'];
      for (let i = 0; i < 5001; i++) lines.push(`User${i},+${i}`);
      const file = createFile(lines.join('\n'));
      await expect(controller.importCsv('biz1', file, {})).rejects.toThrow('5000 data rows');
    });

    it('throws when phone column is missing', async () => {
      const file = createFile('name,email\nEmma,emma@test.com');
      await expect(controller.importCsv('biz1', file, {})).rejects.toThrow('"phone" column');
    });

    it('skips rows without phone', async () => {
      const file = createFile('name,phone\nEmma,+123\nNoPhone,');
      await controller.importCsv('biz1', file, {});
      expect(mockService.bulkCreate).toHaveBeenCalledWith('biz1', [
        { name: 'Emma', phone: '+123', email: undefined, tags: [] },
      ]);
    });

    it('handles RFC 4180 quoted fields with commas', async () => {
      const csv = 'name,phone,tags\n"Wilson, Emma",+123,"VIP;new"';
      await controller.importCsv('biz1', createFile(csv), {});
      expect(mockService.bulkCreate).toHaveBeenCalledWith('biz1', [
        { name: 'Wilson, Emma', phone: '+123', email: undefined, tags: ['VIP', 'new'] },
      ]);
    });

    it('handles RFC 4180 escaped quotes', async () => {
      const csv = 'name,phone\n"She said ""hello""",+123';
      await controller.importCsv('biz1', createFile(csv), {});
      expect(mockService.bulkCreate).toHaveBeenCalledWith('biz1', [
        { name: 'She said "hello"', phone: '+123', email: undefined, tags: [] },
      ]);
    });

    it('handles CSV with only phone column', async () => {
      const csv = 'phone\n+123\n+456';
      await controller.importCsv('biz1', createFile(csv), {});
      expect(mockService.bulkCreate).toHaveBeenCalledWith('biz1', [
        { name: '', phone: '+123', email: undefined, tags: [] },
        { name: '', phone: '+456', email: undefined, tags: [] },
      ]);
    });

    it('handles empty tags field', async () => {
      const csv = 'name,phone,tags\nEmma,+123,';
      await controller.importCsv('biz1', createFile(csv), {});
      expect(mockService.bulkCreate).toHaveBeenCalledWith('biz1', [
        { name: 'Emma', phone: '+123', email: undefined, tags: [] },
      ]);
    });

    it('trims whitespace from headers', async () => {
      const csv = ' name , phone , email \nEmma,+123,e@t.com';
      await controller.importCsv('biz1', createFile(csv), {});
      expect(mockService.bulkCreate).toHaveBeenCalledWith('biz1', [
        { name: 'Emma', phone: '+123', email: 'e@t.com', tags: [] },
      ]);
    });

    it('skips blank lines', async () => {
      const csv = 'name,phone\nEmma,+123\n\n\nBob,+456';
      await controller.importCsv('biz1', createFile(csv), {});
      expect(mockService.bulkCreate).toHaveBeenCalledWith('biz1', [
        { name: 'Emma', phone: '+123', email: undefined, tags: [] },
        { name: 'Bob', phone: '+456', email: undefined, tags: [] },
      ]);
    });
  });

  describe('importFromConversations', () => {
    it('delegates with default includeMessages=true', async () => {
      await controller.importFromConversations('biz1', {});
      expect(mockService.createFromConversations).toHaveBeenCalledWith('biz1', true);
    });

    it('passes includeMessages=false when specified', async () => {
      await controller.importFromConversations('biz1', { includeMessages: false });
      expect(mockService.createFromConversations).toHaveBeenCalledWith('biz1', false);
    });
  });

  describe('listDuplicates', () => {
    it('delegates to mergeService with parsed query params', async () => {
      await controller.listDuplicates('biz1', 'PENDING', '2', '10');
      expect(mockMergeService.listDuplicates).toHaveBeenCalledWith('biz1', {
        status: 'PENDING',
        page: 2,
        pageSize: 10,
      });
    });

    it('handles missing query params', async () => {
      await controller.listDuplicates('biz1');
      expect(mockMergeService.listDuplicates).toHaveBeenCalledWith('biz1', {
        status: undefined,
        page: undefined,
        pageSize: undefined,
      });
    });

    it('returns paginated duplicate list', async () => {
      const expected = {
        data: [{ id: 'dc1', confidence: 0.95 }],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      mockMergeService.listDuplicates.mockResolvedValue(expected);
      const result = await controller.listDuplicates('biz1');
      expect(result).toEqual(expected);
    });
  });

  describe('mergeDuplicate', () => {
    it('delegates to mergeService with candidate id and user info', async () => {
      await controller.mergeDuplicate('biz1', 'dc1', { id: 'staff1', name: 'Sarah' });
      expect(mockMergeService.mergeDuplicateById).toHaveBeenCalledWith(
        'biz1',
        'dc1',
        'staff1',
        'Sarah',
      );
    });

    it('handles user without name', async () => {
      await controller.mergeDuplicate('biz1', 'dc1', { id: 'staff1' });
      expect(mockMergeService.mergeDuplicateById).toHaveBeenCalledWith(
        'biz1',
        'dc1',
        'staff1',
        undefined,
      );
    });

    it('returns merged customer', async () => {
      const merged = { id: 'cust1', name: 'Merged Customer' };
      mockMergeService.mergeDuplicateById.mockResolvedValue(merged);
      const result = await controller.mergeDuplicate('biz1', 'dc1', { id: 'staff1' });
      expect(result).toEqual(merged);
    });
  });

  describe('markNotDuplicate', () => {
    it('delegates to mergeService with candidate id and user id', async () => {
      await controller.markNotDuplicate('biz1', 'dc1', { id: 'staff1' });
      expect(mockMergeService.markNotDuplicateById).toHaveBeenCalledWith('biz1', 'dc1', 'staff1');
    });

    it('handles missing user id', async () => {
      await controller.markNotDuplicate('biz1', 'dc1', {});
      expect(mockMergeService.markNotDuplicateById).toHaveBeenCalledWith('biz1', 'dc1', undefined);
    });

    it('returns updated candidate', async () => {
      const updated = { id: 'dc1', status: 'NOT_DUPLICATE' };
      mockMergeService.markNotDuplicateById.mockResolvedValue(updated);
      const result = await controller.markNotDuplicate('biz1', 'dc1', { id: 'staff1' });
      expect(result).toEqual(updated);
    });
  });

  describe('snoozeDuplicate', () => {
    it('delegates to mergeService with candidate id and user id', async () => {
      await controller.snoozeDuplicate('biz1', 'dc1', { id: 'staff1' });
      expect(mockMergeService.snoozeDuplicate).toHaveBeenCalledWith('biz1', 'dc1', 'staff1');
    });

    it('handles missing user id', async () => {
      await controller.snoozeDuplicate('biz1', 'dc1', {});
      expect(mockMergeService.snoozeDuplicate).toHaveBeenCalledWith('biz1', 'dc1', undefined);
    });

    it('returns snoozed candidate', async () => {
      const snoozed = { id: 'dc1', status: 'SNOOZED' };
      mockMergeService.snoozeDuplicate.mockResolvedValue(snoozed);
      const result = await controller.snoozeDuplicate('biz1', 'dc1', { id: 'staff1' });
      expect(result).toEqual(snoozed);
    });
  });
});
