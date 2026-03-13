import { QualityGateController } from './quality-gates.controller';
import { QualityGateService } from './quality-gates.service';

describe('QualityGateController', () => {
  let controller: QualityGateController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      evaluateGate: jest.fn(),
      getGateStatus: jest.fn(),
    };
    controller = new QualityGateController(
      mockService as unknown as QualityGateService,
    );
  });

  it('evaluateGate delegates to service with businessId, draftId, and gate', async () => {
    mockService.evaluateGate.mockResolvedValue({ passed: true, score: 85 });

    const result = await controller.evaluateGate('biz1', 'draft1', 'GATE_1');

    expect(mockService.evaluateGate).toHaveBeenCalledWith('biz1', 'draft1', 'GATE_1');
    expect(result).toEqual({ passed: true, score: 85 });
  });

  it('getGateStatus delegates to service with businessId and draftId', async () => {
    mockService.getGateStatus.mockResolvedValue({ gates: [], currentGate: 'GATE_2' });

    const result = await controller.getGateStatus('biz1', 'draft1');

    expect(mockService.getGateStatus).toHaveBeenCalledWith('biz1', 'draft1');
    expect(result).toEqual({ gates: [], currentGate: 'GATE_2' });
  });

  it('evaluateGate returns failure result from service', async () => {
    mockService.evaluateGate.mockResolvedValue({ passed: false, score: 40, rejectionCode: 'R03' });

    const result = await controller.evaluateGate('biz1', 'draft2', 'GATE_3');

    expect(mockService.evaluateGate).toHaveBeenCalledWith('biz1', 'draft2', 'GATE_3');
    expect(result).toEqual({ passed: false, score: 40, rejectionCode: 'R03' });
  });
});
