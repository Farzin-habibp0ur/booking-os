import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class TemplateService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string) {
    return this.prisma.messageTemplate.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(businessId: string, id: string) {
    return this.prisma.messageTemplate.findFirst({
      where: { id, businessId },
    });
  }

  async create(
    businessId: string,
    data: { name: string; category: string; body: string; variables?: string[] },
  ) {
    // Auto-extract variables from body
    const variables = data.variables || this.extractVariables(data.body);
    return this.prisma.messageTemplate.create({
      data: { businessId, name: data.name, category: data.category, body: data.body, variables },
    });
  }

  async update(businessId: string, id: string, data: any) {
    if (data.body && !data.variables) {
      data.variables = this.extractVariables(data.body);
    }
    return this.prisma.messageTemplate.update({
      where: { id, businessId },
      data,
    });
  }

  async remove(businessId: string, id: string) {
    return this.prisma.messageTemplate.delete({ where: { id, businessId } });
  }

  private extractVariables(body: string): string[] {
    const matches = body.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
  }

  // M5 fix: HTML-escape user-provided values to prevent XSS in email templates
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // URL values should not be escaped (links need to work in emails)
  private static readonly URL_KEYS = new Set([
    'bookingLink',
    'rescheduleLink',
    'cancelLink',
  ]);

  async resolveVariables(
    template: { body: string; variables: string[] },
    context: {
      customerName?: string;
      serviceName?: string;
      date?: string;
      time?: string;
      staffName?: string;
      businessName?: string;
      bookingLink?: string;
      rescheduleLink?: string;
      cancelLink?: string;
      depositAmount?: string;
    },
  ): Promise<string> {
    let resolved = template.body;
    const map: Record<string, string | undefined> = {
      customerName: context.customerName,
      serviceName: context.serviceName,
      date: context.date,
      time: context.time,
      staffName: context.staffName,
      businessName: context.businessName,
      bookingLink: context.bookingLink,
      rescheduleLink: context.rescheduleLink,
      cancelLink: context.cancelLink,
      depositAmount: context.depositAmount,
    };
    for (const [key, value] of Object.entries(map)) {
      if (value) {
        const safe = TemplateService.URL_KEYS.has(key) ? value : this.escapeHtml(value);
        resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), safe);
      }
    }
    return resolved;
  }
}
