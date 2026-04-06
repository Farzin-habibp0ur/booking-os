import { Controller, Get, Param, Headers, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { TrackingService } from './tracking.service';

@Controller('t')
@Throttle({ default: { ttl: 60000, limit: 100 } })
export class TrackingController {
  constructor(private trackingService: TrackingService) {}

  @Get(':trackingId')
  async track(
    @Param('trackingId') trackingId: string,
    @Headers('user-agent') userAgent: string,
    @Res() res: Response,
  ) {
    const result = await this.trackingService.recordClick(trackingId, userAgent);
    return res.redirect(302, result.url);
  }

  @Get('o/:pixelId')
  async trackOpen(@Param('pixelId') pixelId: string, @Res() res: Response) {
    await this.trackingService.recordOpen(pixelId);
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' });
    return res.send(pixel);
  }
}
