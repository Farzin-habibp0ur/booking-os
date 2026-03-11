import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateMedicalRecordDto } from './dto';

@Injectable()
export class MedicalRecordService {
  constructor(private prisma: PrismaService) {}

  async create(businessId: string, dto: CreateMedicalRecordDto, recordedById?: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, businessId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const existing = await this.prisma.medicalRecord.findFirst({
      where: { customerId: dto.customerId, isCurrent: true },
      select: { id: true, version: true },
    });

    const flagParts: string[] = [];
    if (dto.allergies && dto.allergies.length > 0) {
      flagParts.push(`Allergies: ${dto.allergies.join(', ')}`);
    }
    if (dto.contraindications && dto.contraindications.length > 0) {
      flagParts.push(`Contraindications: ${dto.contraindications.join(', ')}`);
    }
    if (dto.bloodThinners) {
      flagParts.push('Blood thinners');
    }
    if (dto.pregnant) {
      flagParts.push('Pregnant');
    }
    if (dto.breastfeeding) {
      flagParts.push('Breastfeeding');
    }

    const flagged = flagParts.length > 0;
    const flagReason = flagged ? flagParts.join('; ') : dto.flagReason || null;

    const newVersion = (existing?.version || 0) + 1;
    const consentDate = dto.consentGiven ? new Date() : null;

    return this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.medicalRecord.update({
          where: { id: existing.id },
          data: { isCurrent: false },
        });
      }

      return tx.medicalRecord.create({
        data: {
          businessId,
          customerId: dto.customerId,
          allergies: dto.allergies || [],
          contraindications: dto.contraindications || [],
          medications: dto.medications || [],
          conditions: dto.conditions || [],
          skinType: dto.skinType || null,
          fitzpatrickScale: dto.fitzpatrickScale || null,
          bloodThinners: dto.bloodThinners || false,
          pregnant: dto.pregnant || false,
          breastfeeding: dto.breastfeeding || false,
          recentSurgery: dto.recentSurgery || null,
          notes: dto.notes || null,
          flagged,
          flagReason,
          consentGiven: dto.consentGiven || false,
          consentDate,
          version: newVersion,
          isCurrent: true,
          recordedById: recordedById || null,
        },
      });
    });
  }

  async getCurrent(businessId: string, customerId: string) {
    return this.prisma.medicalRecord.findFirst({
      where: { customerId, businessId, isCurrent: true },
      include: { recordedBy: { select: { name: true } } },
    });
  }

  async getHistory(businessId: string, recordId: string) {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { id: recordId },
    });

    if (!record || record.businessId !== businessId) {
      throw new NotFoundException('Medical record not found');
    }

    return this.prisma.medicalRecord.findMany({
      where: { customerId: record.customerId },
      orderBy: { version: 'desc' },
      include: { recordedBy: { select: { name: true } } },
    });
  }

  async checkMedicalClearance(businessId: string, customerId: string) {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { customerId, businessId, isCurrent: true },
    });

    return {
      hasMedicalRecord: !!record,
      flagged: record?.flagged || false,
      flagReason: record?.flagReason || null,
    };
  }
}
