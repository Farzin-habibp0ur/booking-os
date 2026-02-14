import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class TranslationService {
  constructor(private prisma: PrismaService) {}

  async getOverrides(businessId: string, locale: string): Promise<Record<string, string>> {
    const rows = await this.prisma.translation.findMany({
      where: { businessId, locale },
    });
    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return map;
  }

  async getAllKeys(businessId: string, locale: string) {
    const overrides = await this.prisma.translation.findMany({
      where: { businessId, locale },
    });
    return overrides.map((o) => ({
      id: o.id,
      key: o.key,
      value: o.value,
      updatedAt: o.updatedAt,
    }));
  }

  async upsert(businessId: string, locale: string, key: string, value: string) {
    return this.prisma.translation.upsert({
      where: {
        businessId_locale_key: { businessId, locale, key },
      },
      create: { businessId, locale, key, value },
      update: { value },
    });
  }

  async remove(businessId: string, locale: string, key: string) {
    return this.prisma.translation.deleteMany({
      where: { businessId, locale, key },
    });
  }
}
