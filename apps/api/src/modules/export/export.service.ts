import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ActionHistoryService } from '../action-history/action-history.service';

const MAX_EXPORT_ROWS = 10000;

function escapeCsvField(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: (string | null | undefined)[]): string {
  return fields.map(escapeCsvField).join(',');
}

export interface ExportOptions {
  dateFrom?: string;
  dateTo?: string;
  fields?: string[];
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private prisma: PrismaService,
    private actionHistoryService: ActionHistoryService,
  ) {}

  async exportCustomersCsv(businessId: string, opts: ExportOptions = {}): Promise<string> {
    const where: any = { businessId };

    if (opts.dateFrom || opts.dateTo) {
      where.createdAt = {};
      if (opts.dateFrom) where.createdAt.gte = new Date(opts.dateFrom);
      if (opts.dateTo) where.createdAt.lte = new Date(opts.dateTo);
    }

    const customers = await this.prisma.customer.findMany({
      where,
      take: MAX_EXPORT_ROWS,
      orderBy: { createdAt: 'desc' },
    });

    const allFields = ['id', 'name', 'phone', 'email', 'tags', 'createdAt', 'updatedAt'];
    const fields = opts.fields?.length
      ? allFields.filter((f) => opts.fields!.includes(f))
      : allFields;

    const rows: string[] = [toCsvRow(fields)];

    for (const c of customers) {
      const row = fields.map((f) => {
        const val = (c as any)[f];
        if (f === 'tags' && Array.isArray(val)) return val.join('; ');
        if (val instanceof Date) return val.toISOString();
        return val != null ? String(val) : '';
      });
      rows.push(toCsvRow(row));
    }

    this.logger.log(`Exported ${customers.length} customers for business ${businessId}`);

    try {
      await this.actionHistoryService.create({
        businessId,
        actorType: 'STAFF',
        action: 'CSV_EXPORT',
        entityType: 'CUSTOMER',
        entityId: businessId,
        description: `Exported ${customers.length} customers to CSV`,
        metadata: {
          rowCount: customers.length,
          fields,
          dateFrom: opts.dateFrom,
          dateTo: opts.dateTo,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to log customer export action: ${err.message}`);
    }

    return rows.join('\r\n') + '\r\n';
  }

  async exportBookingsCsv(businessId: string, opts: ExportOptions = {}): Promise<string> {
    const where: any = { businessId };

    if (opts.dateFrom || opts.dateTo) {
      where.startTime = {};
      if (opts.dateFrom) where.startTime.gte = new Date(opts.dateFrom);
      if (opts.dateTo) where.startTime.lte = new Date(opts.dateTo);
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: { customer: true, service: true, staff: true },
      take: MAX_EXPORT_ROWS,
      orderBy: { startTime: 'desc' },
    });

    const allFields = [
      'id',
      'customerName',
      'customerPhone',
      'customerEmail',
      'serviceName',
      'staffName',
      'status',
      'startTime',
      'endTime',
      'notes',
      'createdAt',
    ];
    const fields = opts.fields?.length
      ? allFields.filter((f) => opts.fields!.includes(f))
      : allFields;

    const rows: string[] = [toCsvRow(fields)];

    for (const b of bookings) {
      const fieldMap: Record<string, string> = {
        id: b.id,
        customerName: b.customer?.name || '',
        customerPhone: b.customer?.phone || '',
        customerEmail: b.customer?.email || '',
        serviceName: b.service?.name || '',
        staffName: b.staff?.name || '',
        status: b.status,
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
        notes: b.notes || '',
        createdAt: b.createdAt.toISOString(),
      };
      rows.push(toCsvRow(fields.map((f) => fieldMap[f] || '')));
    }

    this.logger.log(`Exported ${bookings.length} bookings for business ${businessId}`);

    try {
      await this.actionHistoryService.create({
        businessId,
        actorType: 'STAFF',
        action: 'CSV_EXPORT',
        entityType: 'BOOKING',
        entityId: businessId,
        description: `Exported ${bookings.length} bookings to CSV`,
        metadata: {
          rowCount: bookings.length,
          fields,
          dateFrom: opts.dateFrom,
          dateTo: opts.dateTo,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to log booking export action: ${err.message}`);
    }

    return rows.join('\r\n') + '\r\n';
  }
}
