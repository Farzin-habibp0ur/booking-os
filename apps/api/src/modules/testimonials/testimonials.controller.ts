import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Optional,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TestimonialsService } from './testimonials.service';
import { AutomationExecutorService } from '../automation/automation-executor.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';

@ApiTags('Testimonials')
@Controller('testimonials')
export class TestimonialsController {
  private readonly logger = new Logger(TestimonialsController.name);

  constructor(
    private testimonialsService: TestimonialsService,
    @Optional() @Inject(forwardRef(() => AutomationExecutorService))
    private automationExecutor?: AutomationExecutorService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  create(@BusinessId() businessId: string, @Body() dto: CreateTestimonialDto) {
    return this.testimonialsService.create(businessId, dto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  findAll(
    @BusinessId() businessId: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.testimonialsService.findAll(businessId, {
      status,
      customerId,
      search,
      sortBy,
      sortOrder,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTestimonialDto,
  ) {
    return this.testimonialsService.update(businessId, id, dto);
  }

  @Post(':id/approve')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  approve(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.testimonialsService.approve(businessId, id);
  }

  @Post(':id/reject')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  reject(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.testimonialsService.reject(businessId, id);
  }

  @Post(':id/feature')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  feature(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.testimonialsService.feature(businessId, id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  delete(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.testimonialsService.delete(businessId, id);
  }

  @Post('bulk')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  bulkAction(
    @BusinessId() businessId: string,
    @Body() body: { ids: string[]; action: 'approve' | 'reject' | 'delete' },
  ) {
    return this.testimonialsService.bulkAction(businessId, body.ids, body.action);
  }

  @Get('stats')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  getDashboardStats(@BusinessId() businessId: string) {
    return this.testimonialsService.getDashboardStats(businessId);
  }

  @Post('request')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  sendRequest(@BusinessId() businessId: string, @Body() body: { customerId: string }) {
    return this.testimonialsService.sendRequest(businessId, body.customerId);
  }

  @Get('public/:slug')
  findPublic(@Param('slug') slug: string) {
    return this.testimonialsService.findPublic(slug);
  }

  @Get('public/verify/:token')
  verifyToken(@Param('token') token: string) {
    return this.testimonialsService.verifyToken(token);
  }

  @Post('public/submit')
  async submitByToken(@Body() body: { token: string; content: string; rating: number; name?: string }) {
    const result = await this.testimonialsService.submitByToken(body);

    // Fire TESTIMONIAL_SUBMITTED trigger for automation rules
    if (this.automationExecutor && result) {
      this.automationExecutor
        .evaluateTrigger('TESTIMONIAL_SUBMITTED', {
          businessId: (result as any).businessId,
          customerId: (result as any).customerId,
          rating: body.rating,
          testimonialId: (result as any).id,
        })
        .catch((err) => this.logger.warn(`Trigger evaluation failed: ${err.message}`));
    }

    return result;
  }
}
