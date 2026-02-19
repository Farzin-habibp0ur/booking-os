import { ForbiddenException } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';

describe('BookingController', () => {
  let controller: BookingController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      getCalendar: jest.fn(),
      getMonthSummary: jest.fn(),
      checkPolicyAllowed: jest.fn(),
      getKanbanBoard: jest.fn(),
      updateKanbanStatus: jest.fn(),
      bulkUpdate: jest.fn(),
      sendDepositRequest: jest.fn(),
      sendRescheduleLink: jest.fn(),
      sendCancelLink: jest.fn(),
    };
    controller = new BookingController(mockService as unknown as BookingService);
  });

  it('list delegates to service.findAll', async () => {
    mockService.findAll.mockResolvedValue([{ id: 'b1' }]);
    const query = { status: 'CONFIRMED' };

    const result = await controller.list('biz1', query);

    expect(mockService.findAll).toHaveBeenCalledWith('biz1', query);
    expect(result).toEqual([{ id: 'b1' }]);
  });

  it('detail delegates to service.findById', async () => {
    mockService.findById.mockResolvedValue({ id: 'b1', status: 'CONFIRMED' });

    const result = await controller.detail('biz1', 'b1');

    expect(mockService.findById).toHaveBeenCalledWith('biz1', 'b1');
    expect(result).toEqual({ id: 'b1', status: 'CONFIRMED' });
  });

  it('create delegates to service.create without currentUser when forceBook is false', async () => {
    const body = {
      customerId: 'c1',
      serviceId: 's1',
      startTime: '2026-03-01T10:00:00Z',
      forceBook: false,
    } as any;
    const user = { id: 'staff1', name: 'Sarah', role: 'ADMIN' };
    mockService.create.mockResolvedValue({ id: 'b1' });

    const result = await controller.create('biz1', body, user);

    expect(mockService.create).toHaveBeenCalledWith('biz1', body, undefined);
    expect(result).toEqual({ id: 'b1' });
  });

  it('create passes currentUser when forceBook is true', async () => {
    const body = {
      customerId: 'c1',
      serviceId: 's1',
      startTime: '2026-03-01T10:00:00Z',
      forceBook: true,
    } as any;
    const user = { id: 'staff1', name: 'Sarah', role: 'ADMIN' };
    mockService.create.mockResolvedValue({ id: 'b1' });

    const result = await controller.create('biz1', body, user);

    expect(mockService.create).toHaveBeenCalledWith('biz1', body, {
      staffId: 'staff1',
      staffName: 'Sarah',
      role: 'ADMIN',
    });
    expect(result).toEqual({ id: 'b1' });
  });

  // Security fix: forceBook requires ADMIN role
  it('throws ForbiddenException when non-admin tries forceBook', () => {
    const body = {
      customerId: 'c1',
      serviceId: 's1',
      startTime: '2026-03-01T10:00:00Z',
      forceBook: true,
    } as any;
    const user = { id: 'staff1', name: 'Jane', role: 'SERVICE_PROVIDER' };

    expect(() => controller.create('biz1', body, user)).toThrow(ForbiddenException);
    expect(mockService.create).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when AGENT tries forceBook', () => {
    const body = {
      customerId: 'c1',
      serviceId: 's1',
      startTime: '2026-03-01T10:00:00Z',
      forceBook: true,
    } as any;
    const user = { id: 'staff2', name: 'Agent', role: 'AGENT' };

    expect(() => controller.create('biz1', body, user)).toThrow(ForbiddenException);
    expect(mockService.create).not.toHaveBeenCalled();
  });

  it('update delegates to service.update', async () => {
    const body = { notes: 'Updated notes' } as any;
    mockService.update.mockResolvedValue({ id: 'b1', notes: 'Updated notes' });

    const result = await controller.update('biz1', 'b1', body);

    expect(mockService.update).toHaveBeenCalledWith('biz1', 'b1', body);
    expect(result.notes).toBe('Updated notes');
  });

  it('updateStatus delegates to service.updateStatus with user context', async () => {
    const body = { status: 'CANCELLED', reason: 'Customer no-show' } as any;
    const user = { id: 'staff1', name: 'Sarah', role: 'ADMIN' };
    mockService.updateStatus.mockResolvedValue({ id: 'b1', status: 'CANCELLED' });

    const result = await controller.updateStatus('biz1', 'b1', body, user);

    expect(mockService.updateStatus).toHaveBeenCalledWith('biz1', 'b1', 'CANCELLED', {
      reason: 'Customer no-show',
      staffId: 'staff1',
      staffName: 'Sarah',
      role: 'ADMIN',
    });
    expect(result.status).toBe('CANCELLED');
  });

  it('calendar delegates to service.getCalendar', async () => {
    mockService.getCalendar.mockResolvedValue([{ id: 'b1' }]);

    const result = await controller.calendar('biz1', '2026-03-01', '2026-03-07', 'staff1', 'loc1');

    expect(mockService.getCalendar).toHaveBeenCalledWith(
      'biz1',
      '2026-03-01',
      '2026-03-07',
      'staff1',
      'loc1',
    );
    expect(result).toEqual([{ id: 'b1' }]);
  });

  it('policyCheck delegates to service.checkPolicyAllowed with provided action', async () => {
    mockService.checkPolicyAllowed.mockResolvedValue({ allowed: true });

    const result = await controller.policyCheck('biz1', 'b1', 'reschedule');

    expect(mockService.checkPolicyAllowed).toHaveBeenCalledWith('biz1', 'b1', 'reschedule');
    expect(result).toEqual({ allowed: true });
  });

  it('policyCheck defaults action to cancel when not provided', async () => {
    mockService.checkPolicyAllowed.mockResolvedValue({ allowed: false });

    const result = await controller.policyCheck('biz1', 'b1', undefined as any);

    expect(mockService.checkPolicyAllowed).toHaveBeenCalledWith('biz1', 'b1', 'cancel');
    expect(result).toEqual({ allowed: false });
  });

  it('kanbanBoard delegates to service.getKanbanBoard', async () => {
    mockService.getKanbanBoard.mockResolvedValue({ columns: [] });

    const result = await controller.kanbanBoard(
      'biz1',
      'loc1',
      'staff1',
      '2026-03-01',
      '2026-03-07',
    );

    expect(mockService.getKanbanBoard).toHaveBeenCalledWith('biz1', {
      locationId: 'loc1',
      staffId: 'staff1',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
    });
    expect(result).toEqual({ columns: [] });
  });

  it('updateKanbanStatus delegates to service.updateKanbanStatus', async () => {
    const body = { kanbanStatus: 'IN_PROGRESS' } as any;
    mockService.updateKanbanStatus.mockResolvedValue({ id: 'b1', kanbanStatus: 'IN_PROGRESS' });

    const result = await controller.updateKanbanStatus('biz1', 'b1', body);

    expect(mockService.updateKanbanStatus).toHaveBeenCalledWith('biz1', 'b1', 'IN_PROGRESS');
    expect(result.kanbanStatus).toBe('IN_PROGRESS');
  });

  it('bulkAction delegates to service.bulkUpdate', async () => {
    const body = { ids: ['b1', 'b2'], action: 'status' as const, payload: { status: 'CANCELLED' } };
    const user = { id: 'staff1', name: 'Sarah', role: 'ADMIN' };
    mockService.bulkUpdate.mockResolvedValue({ updated: 2 });

    const result = await controller.bulkAction('biz1', body, user);

    expect(mockService.bulkUpdate).toHaveBeenCalledWith(
      'biz1',
      ['b1', 'b2'],
      'status',
      { status: 'CANCELLED' },
      'ADMIN',
    );
    expect(result).toEqual({ updated: 2 });
  });

  it('sendDepositRequest delegates to service.sendDepositRequest', async () => {
    mockService.sendDepositRequest.mockResolvedValue({ sent: true });

    const result = await controller.sendDepositRequest('biz1', 'b1');

    expect(mockService.sendDepositRequest).toHaveBeenCalledWith('biz1', 'b1');
    expect(result).toEqual({ sent: true });
  });

  it('sendRescheduleLink delegates to service.sendRescheduleLink', async () => {
    const user = { id: 'staff1', name: 'Sarah' };
    mockService.sendRescheduleLink.mockResolvedValue({ sent: true });

    const result = await controller.sendRescheduleLink('biz1', 'b1', user);

    expect(mockService.sendRescheduleLink).toHaveBeenCalledWith('biz1', 'b1', {
      staffId: 'staff1',
      staffName: 'Sarah',
    });
    expect(result).toEqual({ sent: true });
  });

  it('sendCancelLink delegates to service.sendCancelLink', async () => {
    const user = { id: 'staff1', name: 'Sarah' };
    mockService.sendCancelLink.mockResolvedValue({ sent: true });

    const result = await controller.sendCancelLink('biz1', 'b1', user);

    expect(mockService.sendCancelLink).toHaveBeenCalledWith('biz1', 'b1', {
      staffId: 'staff1',
      staffName: 'Sarah',
    });
    expect(result).toEqual({ sent: true });
  });

  it('monthSummary delegates to service.getMonthSummary', async () => {
    const summary = {
      days: { '2026-03-01': { total: 3, confirmed: 2, pending: 1, cancelled: 0 } },
    };
    mockService.getMonthSummary.mockResolvedValue(summary);

    const result = await controller.monthSummary('biz1', '2026-03', 'loc1');

    expect(mockService.getMonthSummary).toHaveBeenCalledWith('biz1', '2026-03', 'loc1');
    expect(result).toEqual(summary);
  });

  it('monthSummary works without locationId', async () => {
    mockService.getMonthSummary.mockResolvedValue({ days: {} });

    const result = await controller.monthSummary('biz1', '2026-03', undefined);

    expect(mockService.getMonthSummary).toHaveBeenCalledWith('biz1', '2026-03', undefined);
    expect(result).toEqual({ days: {} });
  });
});
