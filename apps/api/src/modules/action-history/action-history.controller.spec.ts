import { Test } from '@nestjs/testing';
import { ActionHistoryController } from './action-history.controller';
import { ActionHistoryService } from './action-history.service';
import { createMockActionHistoryService } from '../../test/mocks';

describe('ActionHistoryController', () => {
  let controller: ActionHistoryController;
  let service: ReturnType<typeof createMockActionHistoryService>;

  beforeEach(async () => {
    service = createMockActionHistoryService();

    const module = await Test.createTestingModule({
      controllers: [ActionHistoryController],
      providers: [{ provide: ActionHistoryService, useValue: service }],
    }).compile();

    controller = module.get(ActionHistoryController);
  });

  describe('exportCsv', () => {
    it('sets CSV headers and sends response', async () => {
      const csvData = 'id,actorType\r\nah1,STAFF\r\n';
      service.exportCsv.mockResolvedValue(csvData);

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.exportCsv('biz1', undefined, undefined, undefined, undefined, mockRes);

      expect(service.exportCsv).toHaveBeenCalledWith('biz1', {
        dateFrom: undefined,
        dateTo: undefined,
        entityType: undefined,
        actorType: undefined,
      });
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="audit-log-'),
      );
      expect(mockRes.send).toHaveBeenCalledWith(csvData);
    });

    it('passes filter params to service', async () => {
      service.exportCsv.mockResolvedValue('');
      const mockRes = { setHeader: jest.fn(), send: jest.fn() } as any;

      await controller.exportCsv('biz1', '2026-01-01', '2026-01-31', 'BOOKING', 'AI', mockRes);

      expect(service.exportCsv).toHaveBeenCalledWith('biz1', {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        entityType: 'BOOKING',
        actorType: 'AI',
      });
    });
  });

  describe('findAll', () => {
    it('calls service.findAll with parsed params', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

      const result = await controller.findAll(
        'biz1',
        'BOOKING',
        undefined,
        undefined,
        undefined,
        '1',
        '20',
      );

      expect(service.findAll).toHaveBeenCalledWith('biz1', {
        entityType: 'BOOKING',
        entityId: undefined,
        actorId: undefined,
        action: undefined,
        page: 1,
        pageSize: 20,
      });
      expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    });

    it('passes all filters', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });

      await controller.findAll('biz1', 'BOOKING', 'book1', 'staff1', 'BOOKING_CREATED', '2', '10');

      expect(service.findAll).toHaveBeenCalledWith('biz1', {
        entityType: 'BOOKING',
        entityId: 'book1',
        actorId: 'staff1',
        action: 'BOOKING_CREATED',
        page: 2,
        pageSize: 10,
      });
    });
  });

  describe('findByEntity', () => {
    it('calls service.findByEntity with params', async () => {
      const items = [{ id: 'ah1', action: 'BOOKING_CREATED' }];
      service.findByEntity.mockResolvedValue(items);

      const result = await controller.findByEntity('biz1', 'BOOKING', 'book1');

      expect(service.findByEntity).toHaveBeenCalledWith('biz1', 'BOOKING', 'book1');
      expect(result).toEqual(items);
    });
  });
});
