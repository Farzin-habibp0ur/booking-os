import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BusinessReviewService } from './business-review.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';

@ApiTags('Business Review')
@Controller('business-review')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class BusinessReviewController {
  constructor(private reviewService: BusinessReviewService) {}

  @Get()
  listReviews(@BusinessId() businessId: string) {
    return this.reviewService.listReviews(businessId);
  }

  @Get(':month')
  getReview(@BusinessId() businessId: string, @Param('month') month: string) {
    return this.reviewService.getReview(businessId, month);
  }
}
