import { BadRequestException } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';

describe('CustomerController', () => {
  let controller: CustomerController;
  let mockService: Record<string, jest.Mock>;

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
    controller = new CustomerController(mockService as unknown as CustomerService);
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
});
