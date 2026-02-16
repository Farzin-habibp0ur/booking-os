import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';

describe('RecurringController', () => {
  let controller: RecurringController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      createSeries: jest.fn(),
      getSeriesById: jest.fn(),
      cancelSeries: jest.fn(),
    };
    controller = new RecurringController(mockService as unknown as RecurringService);
  });

  it('createSeries delegates to service', async () => {
    const body = {
      customerId: 'c1',
      serviceId: 's1',
      startDate: '2026-04-01',
      timeOfDay: '10:00',
      daysOfWeek: [2],
      intervalWeeks: 1,
      totalCount: 4,
    };
    mockService.createSeries.mockResolvedValue({ id: 'series1' });

    const result = await controller.createSeries('biz1', body as any);

    expect(mockService.createSeries).toHaveBeenCalledWith('biz1', body);
    expect(result).toEqual({ id: 'series1' });
  });

  it('getSeriesDetail delegates to service', async () => {
    mockService.getSeriesById.mockResolvedValue({ id: 'series1', bookings: [] });

    const result = await controller.getSeriesDetail('biz1', 'series1');

    expect(mockService.getSeriesById).toHaveBeenCalledWith('biz1', 'series1');
    expect(result.id).toBe('series1');
  });

  it('cancelSeries delegates to service with scope and bookingId', async () => {
    mockService.cancelSeries.mockResolvedValue({ cancelled: 2 });

    const result = await controller.cancelSeries('biz1', 'series1', {
      scope: 'future',
      bookingId: 'b2',
    } as any);

    expect(mockService.cancelSeries).toHaveBeenCalledWith('biz1', 'series1', 'future', 'b2');
    expect(result).toEqual({ cancelled: 2 });
  });
});
