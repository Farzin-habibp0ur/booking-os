import { Test } from '@nestjs/testing';
import { ConsoleSupportController } from './console-support.controller';
import { ConsoleSupportService } from './console-support.service';
import { PlatformAuditService } from './platform-audit.service';

describe('ConsoleSupportController', () => {
  let controller: ConsoleSupportController;
  let service: jest.Mocked<ConsoleSupportService>;
  let auditService: jest.Mocked<PlatformAuditService>;

  const mockUser = { sub: 'admin1', email: 'admin@businesscommandcentre.com', name: 'Admin' };

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      addNote: jest.fn(),
    };

    const mockAuditService = {
      log: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [ConsoleSupportController],
      providers: [
        { provide: ConsoleSupportService, useValue: mockService },
        { provide: PlatformAuditService, useValue: mockAuditService },
      ],
    }).compile();

    controller = module.get(ConsoleSupportController);
    service = module.get(ConsoleSupportService) as any;
    auditService = module.get(PlatformAuditService) as any;
  });

  it('list delegates to service', async () => {
    service.findAll.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    const result = await controller.list({ status: 'open' } as any);

    expect(service.findAll).toHaveBeenCalledWith({ status: 'open' });
    expect(result.items).toEqual([]);
  });

  it('create delegates to service and logs audit', async () => {
    const mockCase = { id: 'case1', subject: 'Login issue' };
    service.create.mockResolvedValue(mockCase as any);

    const body = { businessId: 'biz1', subject: 'Login issue', description: 'Cannot log in' };
    const result = await controller.create(body as any, mockUser);

    expect(service.create).toHaveBeenCalledWith(body, 'admin1');
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@businesscommandcentre.com',
      'SUPPORT_CASE_CREATE',
      expect.objectContaining({
        targetType: 'SUPPORT_CASE',
        targetId: 'case1',
        metadata: { businessId: 'biz1', subject: 'Login issue' },
      }),
    );
    expect(result).toEqual(mockCase);
  });

  it('findOne delegates to service', async () => {
    const mockCase = { id: 'case1', subject: 'Login issue', notes: [] };
    service.findById.mockResolvedValue(mockCase as any);

    const result = await controller.findOne('case1');

    expect(service.findById).toHaveBeenCalledWith('case1');
    expect(result).toEqual(mockCase);
  });

  it('update delegates to service and logs audit', async () => {
    const mockCase = { id: 'case1', status: 'resolved' };
    service.update.mockResolvedValue(mockCase as any);

    const body = { status: 'resolved' };
    const result = await controller.update('case1', body as any, mockUser);

    expect(service.update).toHaveBeenCalledWith('case1', body);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@businesscommandcentre.com',
      'SUPPORT_CASE_UPDATE',
      expect.objectContaining({
        targetType: 'SUPPORT_CASE',
        targetId: 'case1',
        metadata: { changes: body },
      }),
    );
    expect(result).toEqual(mockCase);
  });

  it('addNote delegates to service', async () => {
    const mockNote = { id: 'note1', content: 'Looking into it' };
    service.addNote.mockResolvedValue(mockNote as any);

    const body = { content: 'Looking into it' };
    const result = await controller.addNote('case1', body as any, mockUser);

    expect(service.addNote).toHaveBeenCalledWith('case1', body, 'admin1', 'Admin');
    expect(result).toEqual(mockNote);
  });
});
