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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomerService } from './customer.service';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CreateCustomerNoteDto,
  UpdateCustomerNoteDto,
} from '../../common/dto';

@ApiTags('Customers')
@Controller('customers')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class CustomerController {
  private readonly logger = new Logger(CustomerController.name);

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

  @Get(':id/notes')
  getNotes(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.customerService.getNotes(businessId, id);
  }

  @Post(':id/notes')
  createNote(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: CreateCustomerNoteDto,
    @CurrentUser() user: any,
  ) {
    return this.customerService.createNote(businessId, id, user.id, body.content);
  }

  @Patch(':id/notes/:noteId')
  updateNote(
    @BusinessId() businessId: string,
    @Param('id') _id: string,
    @Param('noteId') noteId: string,
    @Body() body: UpdateCustomerNoteDto,
    @CurrentUser() user: any,
  ) {
    return this.customerService.updateNote(businessId, noteId, user.id, body.content);
  }

  @Delete(':id/notes/:noteId')
  deleteNote(
    @BusinessId() businessId: string,
    @Param('id') _id: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: any,
  ) {
    return this.customerService.deleteNote(businessId, noteId, user.id);
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
  async importCsv(
    @BusinessId() businessId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    // M6 fix: File size limit (2MB)
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('CSV file must be under 2MB');
    }

    const content = file.buffer.toString('utf-8');
    const lines = content.split('\n').filter((l) => l.trim());
    if (lines.length < 2)
      throw new BadRequestException('CSV must have a header and at least one data row');
    // M6 fix: Row limit to prevent DoS
    if (lines.length > 5001) throw new BadRequestException('CSV must have at most 5000 data rows');

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIdx = header.findIndex((h) => h === 'name');
    const phoneIdx = header.findIndex((h) => h === 'phone');
    const emailIdx = header.findIndex((h) => h === 'email');
    const tagsIdx = header.findIndex((h) => h === 'tags');

    if (phoneIdx === -1) throw new BadRequestException('CSV must have a "phone" column');

    // M6 fix: RFC 4180-aware field parsing (handle quoted fields with commas)
    const parseRow = (line: string): string[] => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            current += ch;
          }
        } else {
          if (ch === '"') {
            inQuotes = true;
          } else if (ch === ',') {
            fields.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
      }
      fields.push(current.trim());
      return fields;
    };

    const customers = lines
      .slice(1)
      .map((line) => {
        const cols = parseRow(line);
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

    const result = await this.customerService.bulkCreate(businessId, customers);

    // M13 fix: Audit log for CSV import
    this.logger.log(
      `CSV_IMPORT business=${businessId} staff=${user?.id || 'unknown'} rows=${customers.length} file=${file.originalname || 'unknown'}`,
    );

    return result;
  }

  @Post('import-from-conversations')
  async importFromConversations(
    @BusinessId() businessId: string,
    @Body() body: { includeMessages?: boolean },
  ) {
    return this.customerService.createFromConversations(businessId, body.includeMessages !== false);
  }
}
