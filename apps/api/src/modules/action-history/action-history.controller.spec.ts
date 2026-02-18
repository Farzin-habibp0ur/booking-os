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
