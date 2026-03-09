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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ExportOptions {
  dateFrom?: string;
  dateTo?: string;
  fields?: string[];
}

export type ReportType =
  | 'bookings-over-time'
  | 'revenue-over-time'
  | 'no-show-rate'
  | 'response-times'
  | 'service-breakdown'
  | 'staff-performance'
  | 'status-breakdown'
  | 'peak-hours'
  | 'consult-conversion'
  | 'deposit-compliance';

export interface ReportExportOptions {
  days?: number;
}

interface ReportColumn {
  header: string;
  key: string;
}

const REPORT_COLUMNS: Record<ReportType, ReportColumn[]> = {
  'bookings-over-time': [
    { header: 'Date', key: 'date' },
    { header: 'Count', key: 'count' },
  ],
  'revenue-over-time': [
    { header: 'Date', key: 'date' },
    { header: 'Revenue', key: 'revenue' },
  ],
  'no-show-rate': [
    { header: 'Total Bookings', key: 'total' },
    { header: 'No-Shows', key: 'noShows' },
    { header: 'Rate (%)', key: 'rate' },
  ],
  'response-times': [
    { header: 'Avg Response (min)', key: 'avgMinutes' },
    { header: 'Sample Size', key: 'sampleSize' },
  ],
  'service-breakdown': [
    { header: 'Service', key: 'name' },
    { header: 'Bookings', key: 'count' },
    { header: 'Revenue', key: 'revenue' },
  ],
  'staff-performance': [
    { header: 'Staff', key: 'name' },
    { header: 'Total Bookings', key: 'total' },
    { header: 'Completed', key: 'completed' },
    { header: 'No-Shows', key: 'noShows' },
    { header: 'No-Show Rate (%)', key: 'noShowRate' },
    { header: 'Revenue', key: 'revenue' },
  ],
  'status-breakdown': [
    { header: 'Status', key: 'status' },
    { header: 'Count', key: 'count' },
  ],
  'peak-hours': [
    { header: 'Hour', key: 'hour' },
    { header: 'Count', key: 'count' },
  ],
  'consult-conversion': [
    { header: 'Consult Customers', key: 'consultCustomers' },
    { header: 'Converted', key: 'converted' },
    { header: 'Rate (%)', key: 'rate' },
  ],
  'deposit-compliance': [
    { header: 'Total Required', key: 'totalRequired' },
    { header: 'Paid', key: 'paid' },
    { header: 'Rate (%)', key: 'rate' },
  ],
};

const REPORT_TITLES: Record<ReportType, string> = {
  'bookings-over-time': 'Bookings Over Time',
  'revenue-over-time': 'Revenue Over Time',
  'no-show-rate': 'No-Show Rate',
  'response-times': 'Response Times',
  'service-breakdown': 'Service Breakdown',
  'staff-performance': 'Staff Performance',
  'status-breakdown': 'Booking Status Breakdown',
  'peak-hours': 'Peak Hours',
  'consult-conversion': 'Consult to Treatment Conversion',
  'deposit-compliance': 'Deposit Compliance',
};

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

  /**
   * Convert report data to CSV. Normalizes single-object responses into an array.
   */
  exportReportCsv(reportType: ReportType, data: any): string {
    const columns = REPORT_COLUMNS[reportType];
    if (!columns) {
      throw new Error(`Unknown report type: ${reportType}`);
    }

    // Normalize data: single object → array, peak-hours byHour → array
    let rows: any[];
    if (reportType === 'peak-hours') {
      rows = Array.isArray(data?.byHour) ? data.byHour : [];
    } else if (Array.isArray(data)) {
      rows = data;
    } else {
      rows = [data];
    }

    const csvRows: string[] = [toCsvRow(columns.map((c) => c.header))];

    for (const row of rows) {
      csvRows.push(toCsvRow(columns.map((c) => String(row[c.key] ?? ''))));
    }

    this.logger.log(`Exported report ${reportType}: ${rows.length} rows`);

    return csvRows.join('\r\n') + '\r\n';
  }

  /**
   * Convert report data to a self-contained HTML document styled as a printable PDF.
   * The response is HTML that can be saved as .html and printed to PDF in any browser.
   */
  exportReportPdf(reportType: ReportType, data: any): string {
    const columns = REPORT_COLUMNS[reportType];
    const title = REPORT_TITLES[reportType];
    if (!columns) {
      throw new Error(`Unknown report type: ${reportType}`);
    }

    // Normalize data
    let rows: any[];
    if (reportType === 'peak-hours') {
      rows = Array.isArray(data?.byHour) ? data.byHour : [];
    } else if (Array.isArray(data)) {
      rows = data;
    } else {
      rows = [data];
    }

    const headerCells = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('');

    const bodyRows = rows
      .map((row) => {
        const cells = columns
          .map((c) => `<td>${escapeHtml(String(row[c.key] ?? ''))}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    const generatedAt = new Date().toISOString().split('T')[0];

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; color: #1e293b; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #f8fafc; text-align: left; padding: 10px 12px; font-size: 12px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
  tr:hover { background: #f8fafc; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">Generated ${escapeHtml(generatedAt)}</div>
<table>
<thead><tr>${headerCells}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;
  }
}
