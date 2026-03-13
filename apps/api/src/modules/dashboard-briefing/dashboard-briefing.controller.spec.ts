import { DashboardBriefingController } from './dashboard-briefing.controller';
import { DashboardBriefingService } from './dashboard-briefing.service';

describe('DashboardBriefingController', () => {
  let controller: DashboardBriefingController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      getBriefingFeed: jest.fn(),
      getBriefingCount: jest.fn(),
      executeBriefingAction: jest.fn(),
      getMonthlyReview: jest.fn(),
      generateMonthlyReview: jest.fn(),
    };
    controller = new DashboardBriefingController(
      mockService as unknown as DashboardBriefingService,
    );
  });

  it('getBriefing delegates to service.getBriefingFeed with businessId', async () => {
    mockService.getBriefingFeed.mockResolvedValue([{ id: 'b1', title: 'Daily Update' }]);

    const result = await controller.getBriefing('biz1');

    expect(mockService.getBriefingFeed).toHaveBeenCalledWith('biz1');
    expect(result).toEqual([{ id: 'b1', title: 'Daily Update' }]);
  });

  it('getBriefingCount delegates to service.getBriefingCount with businessId', async () => {
    mockService.getBriefingCount.mockResolvedValue({ count: 3 });

    const result = await controller.getBriefingCount('biz1');

    expect(mockService.getBriefingCount).toHaveBeenCalledWith('biz1');
    expect(result).toEqual({ count: 3 });
  });

  it('executeBriefingAction delegates to service with businessId, id, action, and user.id', async () => {
    const user = { id: 'user1', name: 'John' };
    mockService.executeBriefingAction.mockResolvedValue({ success: true });

    const result = await controller.executeBriefingAction('biz1', 'b1', 'dismiss', user);

    expect(mockService.executeBriefingAction).toHaveBeenCalledWith(
      'biz1',
      'b1',
      'dismiss',
      'user1',
    );
    expect(result).toEqual({ success: true });
  });

  it('getMonthlyReview delegates to service with businessId', async () => {
    mockService.getMonthlyReview.mockResolvedValue({ month: 'March', revenue: 5000 });

    const result = await controller.getMonthlyReview('biz1');

    expect(mockService.getMonthlyReview).toHaveBeenCalledWith('biz1');
    expect(result).toEqual({ month: 'March', revenue: 5000 });
  });

  it('generateMonthlyReview delegates to service with businessId', async () => {
    mockService.generateMonthlyReview.mockResolvedValue({ generated: true });

    const result = await controller.generateMonthlyReview('biz1');

    expect(mockService.generateMonthlyReview).toHaveBeenCalledWith('biz1');
    expect(result).toEqual({ generated: true });
  });
});
