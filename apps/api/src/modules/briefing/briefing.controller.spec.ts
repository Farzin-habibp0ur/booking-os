import { Test } from '@nestjs/testing';
import { BriefingController } from './briefing.controller';
import { BriefingService } from './briefing.service';

describe('BriefingController', () => {
  let controller: BriefingController;
  let briefingService: { getBriefing: jest.Mock; getOpportunities: jest.Mock };

  beforeEach(async () => {
    briefingService = {
      getBriefing: jest.fn().mockResolvedValue({
        groups: [],
        totalPending: 0,
        urgentCount: 0,
        lastRefreshed: new Date(),
      }),
      getOpportunities: jest.fn().mockResolvedValue([]),
    };

    const module = await Test.createTestingModule({
      controllers: [BriefingController],
      providers: [{ provide: BriefingService, useValue: briefingService }],
    }).compile();

    controller = module.get(BriefingController);
  });

  it('calls getBriefing with correct params', async () => {
    const req = { user: { sub: 'staff-1', role: 'ADMIN' } };
    await controller.getBriefing('biz-1', req);

    expect(briefingService.getBriefing).toHaveBeenCalledWith('biz-1', 'staff-1', 'ADMIN');
  });

  it('calls getOpportunities with businessId', async () => {
    await controller.getOpportunities('biz-1');

    expect(briefingService.getOpportunities).toHaveBeenCalledWith('biz-1');
  });
});
