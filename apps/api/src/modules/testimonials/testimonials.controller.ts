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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TestimonialsService } from './testimonials.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';

@ApiTags('Testimonials')
@Controller('testimonials')
export class TestimonialsController {
  constructor(private testimonialsService: TestimonialsService) {}

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
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.testimonialsService.findAll(businessId, {
      status,
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

  @Post('request')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  sendRequest(@BusinessId() businessId: string, @Body() body: { customerId: string }) {
    return this.testimonialsService.sendRequest(businessId, body.customerId);
  }

  @Get('public/:slug')
  findPublic(@Param('slug') slug: string) {
    return this.testimonialsService.findPublic(slug);
  }
}
