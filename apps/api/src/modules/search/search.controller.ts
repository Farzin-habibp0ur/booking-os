import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { BusinessId } from '../../common/decorators';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  search(
    @BusinessId() businessId: string,
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('types') types?: string,
  ) {
    const parsedTypes = types
      ? types
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;
    return this.searchService.globalSearch(
      businessId,
      query,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
      parsedTypes,
    );
  }
}
