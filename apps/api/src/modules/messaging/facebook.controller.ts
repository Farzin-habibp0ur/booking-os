import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { MessagingService } from './messaging.service';
import { FacebookProvider } from '@booking-os/messaging-provider';

@ApiTags('Messaging - Facebook')
@Controller('messaging/facebook')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class FacebookController {
  private readonly logger = new Logger(FacebookController.name);

  constructor(private messagingService: MessagingService) {}

  /**
   * GET /messaging/facebook/page-info
   * Test connection by fetching page info using the provided credentials.
   */
  @Get('page-info')
  async getPageInfo(
    @Query('pageId') pageId: string,
    @Query('accessToken') accessToken: string,
    @BusinessId() businessId: string,
  ) {
    if (!pageId || !accessToken) {
      throw new BadRequestException('pageId and accessToken are required');
    }

    try {
      // Create a temporary provider to test the connection
      const tempProvider = new FacebookProvider({
        pageId,
        pageAccessToken: accessToken,
      });
      const pageInfo = await tempProvider.getPageInfo();

      this.logger.log(
        `Facebook page info fetched for business ${businessId}: ${pageInfo.name} (${pageInfo.id})`,
      );

      return { id: pageInfo.id, name: pageInfo.name };
    } catch (err: any) {
      this.logger.error(
        `Facebook page info fetch failed for business ${businessId}: ${err.message}`,
      );
      throw new BadRequestException(`Failed to fetch page info: ${err.message}`);
    }
  }

  /**
   * POST /messaging/facebook/ice-breakers
   * Set ice breaker prompts for a Facebook page.
   */
  @Post('ice-breakers')
  async setIceBreakers(
    @Body()
    body: {
      pageId: string;
      prompts: Array<{ question: string; payload: string }>;
    },
    @BusinessId() businessId: string,
  ) {
    if (!body.pageId) {
      throw new BadRequestException('pageId is required');
    }

    if (!body.prompts || !Array.isArray(body.prompts)) {
      throw new BadRequestException('prompts array is required');
    }

    if (body.prompts.length > 4) {
      throw new BadRequestException('Maximum 4 ice breakers allowed');
    }

    const provider = this.messagingService.getProviderForFacebookPageId(body.pageId);
    if (!provider) {
      throw new BadRequestException(
        'Facebook provider not configured for this page. Save page credentials first.',
      );
    }

    try {
      await provider.setIceBreakers(body.prompts);
      this.logger.log(
        `Ice breakers set for business ${businessId}, page ${body.pageId}: ${body.prompts.length} prompts`,
      );
      return { ok: true, count: body.prompts.length };
    } catch (err: any) {
      this.logger.error(`Failed to set ice breakers for business ${businessId}: ${err.message}`);
      throw new BadRequestException(`Failed to set ice breakers: ${err.message}`);
    }
  }
}
