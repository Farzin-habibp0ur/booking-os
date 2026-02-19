import { Test } from '@nestjs/testing';
import { ConsoleBusinessesController } from './console-businesses.controller';
import { ConsoleBusinessesService } from './console-businesses.service';
import { PlatformAuditService } from './platform-audit.service';

describe('ConsoleBusinessesController', () => {
  let controller: ConsoleBusinessesController;
  let service: jest.Mocked<ConsoleBusinessesService>;
  let auditService: jest.Mocked<PlatformAuditService>;

  const mockUser = { sub: 'admin1', email: 'admin@businesscommandcentre.com' };

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      getStaff: jest.fn(),
      getUsageSnapshot: jest.fn(),
    };

    const mockAuditService = {
      log: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [ConsoleBusinessesController],
      providers: [
        { provide: ConsoleBusinessesService, useValue: mockService },
        { provide: PlatformAuditService, useValue: mockAuditService },
      ],
    }).compile();

    controller = module.get(ConsoleBusinessesController);
    service = module.get(ConsoleBusinessesService) as any;
    auditService = module.get(PlatformAuditService) as any;
  });

  it('list delegates to service and logs audit', async () => {
    service.findAll.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    const result = await controller.list({ search: 'test' }, mockUser);

    expect(service.findAll).toHaveBeenCalledWith({ search: 'test' });
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@businesscommandcentre.com',
      'BUSINESS_LIST',
      expect.any(Object),
    );
    expect(result.items).toEqual([]);
  });

  it('findOne delegates to service and logs audit', async () => {
    const mockBiz = { id: 'biz1', name: 'Test' };
    service.findById.mockResolvedValue(mockBiz as any);

    const result = await controller.findOne('biz1', mockUser);

    expect(service.findById).toHaveBeenCalledWith('biz1');
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@businesscommandcentre.com',
      'BUSINESS_LOOKUP',
      expect.objectContaining({ targetType: 'BUSINESS', targetId: 'biz1' }),
    );
    expect(result).toEqual(mockBiz);
  });

  it('getStaff delegates to service and logs audit', async () => {
    service.getStaff.mockResolvedValue([{ id: 's1', name: 'Staff' }] as any);

    const result = await controller.getStaff('biz1', mockUser);

    expect(service.getStaff).toHaveBeenCalledWith('biz1');
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@businesscommandcentre.com',
      'BUSINESS_STAFF_LOOKUP',
      expect.objectContaining({ targetType: 'BUSINESS', targetId: 'biz1' }),
    );
    expect(result).toHaveLength(1);
  });

  it('getUsage delegates to service and logs audit', async () => {
    const mockUsage = { bookings7d: 10, bookings30d: 40 };
    service.getUsageSnapshot.mockResolvedValue(mockUsage as any);

    const result = await controller.getUsage('biz1', mockUser);

    expect(service.getUsageSnapshot).toHaveBeenCalledWith('biz1');
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@businesscommandcentre.com',
      'BUSINESS_USAGE_LOOKUP',
      expect.objectContaining({ targetType: 'BUSINESS', targetId: 'biz1' }),
    );
    expect(result).toEqual(mockUsage);
  });
});
