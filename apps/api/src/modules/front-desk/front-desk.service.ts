import { Injectable } from '@nestjs/common';
import { FrontDeskAttributionService } from './front-desk-attribution.service';

/**
 * Phase 4 (BCC v3): /front-desk/summary now returns the two-metric shape
 * (captured + wouldHaveBeenMissed + responseTimeMedianMinutes + baseline).
 * The legacy funnel-shape (leadsCaptured/approvedReplies/...) is replaced.
 *
 * The actual aggregation lives in FrontDeskAttributionService so the same
 * code path is used by the booking-creation hook and the dashboard. This
 * service is a thin delegate kept for the existing controller wiring.
 */
@Injectable()
export class FrontDeskService {
  constructor(private attribution: FrontDeskAttributionService) {}

  async getSummary(businessId: string, days = 30) {
    return this.attribution.getSummary(businessId, days);
  }
}
