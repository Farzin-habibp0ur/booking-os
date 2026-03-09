import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PortalAuthService } from './portal-auth.service';
import { PortalService } from './portal.service';
import { PortalGuard } from './portal-auth.guard';
import { RequestOtpDto, VerifyOtpDto, RequestMagicLinkDto, UpdatePortalProfileDto } from './dto';

@Controller('portal')
export class PortalController {
  constructor(
    private authService: PortalAuthService,
    private portalService: PortalService,
  ) {}

  @Post('auth/request-otp')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.slug, dto.phone);
  }

  @Post('auth/verify-otp')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.slug, dto.phone, dto.otp);
  }

  @Post('auth/magic-link')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  requestMagicLink(@Body() dto: RequestMagicLinkDto) {
    return this.authService.requestMagicLink(dto.slug, dto.email);
  }

  @Get('auth/verify-magic-link')
  verifyMagicLink(@Query('token') token: string) {
    return this.authService.verifyMagicLink(token);
  }

  @Get('me')
  @UseGuards(PortalGuard)
  getProfile(@Req() req: any) {
    const { customerId, businessId } = req.portalUser;
    return this.portalService.getProfile(customerId, businessId);
  }

  @Patch('me')
  @UseGuards(PortalGuard)
  updateProfile(@Req() req: any, @Body() dto: UpdatePortalProfileDto) {
    const { customerId, businessId } = req.portalUser;
    return this.portalService.updateProfile(customerId, businessId, dto);
  }

  @Get('bookings')
  @UseGuards(PortalGuard)
  getBookings(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('status') status?: string,
  ) {
    const { customerId, businessId } = req.portalUser;
    return this.portalService.getBookings(customerId, businessId, {
      page: page ? parseInt(page, 10) : 1,
      status,
    });
  }

  @Get('upcoming')
  @UseGuards(PortalGuard)
  getUpcoming(@Req() req: any) {
    const { customerId, businessId } = req.portalUser;
    return this.portalService.getUpcoming(customerId, businessId);
  }
}
