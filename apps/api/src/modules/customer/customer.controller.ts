import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomerService } from './customer.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { CreateCustomerDto, UpdateCustomerDto } from '../../common/dto';

@ApiTags('Customers')
@Controller('customers')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class CustomerController {
  constructor(private customerService: CustomerService) {}

  @Get()
  list(
    @BusinessId() businessId: string,
    @Query() query: { search?: string; page?: string; pageSize?: string },
  ) {
    return this.customerService.findAll(businessId, {
      search: query.search,
      page: query.page ? parseInt(query.page) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
    });
  }

  @Get(':id')
  detail(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.customerService.findById(businessId, id);
  }

  @Post()
  create(@BusinessId() businessId: string, @Body() body: CreateCustomerDto) {
    return this.customerService.create(businessId, body);
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateCustomerDto,
  ) {
    return this.customerService.update(businessId, id, body);
  }

  @Get(':id/bookings')
  bookings(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.customerService.getBookings(businessId, id);
  }

  @Patch('bulk')
  bulkAction(
    @BusinessId() businessId: string,
    @Body() body: { ids: string[]; action: 'tag' | 'untag'; payload: any },
  ) {
    return this.customerService.bulkUpdate(businessId, body.ids, body.action, body.payload);
  }

  @Post('import-csv')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(@BusinessId() businessId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');

    const content = file.buffer.toString('utf-8');
    const lines = content.split('\n').filter((l) => l.trim());
    if (lines.length < 2)
      throw new BadRequestException('CSV must have a header and at least one data row');

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIdx = header.findIndex((h) => h === 'name');
    const phoneIdx = header.findIndex((h) => h === 'phone');
    const emailIdx = header.findIndex((h) => h === 'email');
    const tagsIdx = header.findIndex((h) => h === 'tags');

    if (phoneIdx === -1) throw new BadRequestException('CSV must have a "phone" column');

    const customers = lines
      .slice(1)
      .map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        return {
          name: nameIdx >= 0 ? cols[nameIdx] || '' : '',
          phone: cols[phoneIdx] || '',
          email: emailIdx >= 0 ? cols[emailIdx] || undefined : undefined,
          tags:
            tagsIdx >= 0 && cols[tagsIdx]
              ? cols[tagsIdx]
                  .split(';')
                  .map((t) => t.trim())
                  .filter(Boolean)
              : [],
        };
      })
      .filter((c) => c.phone);

    return this.customerService.bulkCreate(businessId, customers);
  }

  @Post('import-from-conversations')
  async importFromConversations(
    @BusinessId() businessId: string,
    @Body() body: { includeMessages?: boolean },
  ) {
    return this.customerService.createFromConversations(businessId, body.includeMessages !== false);
  }
}
