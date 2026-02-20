import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma.service';
import { PlatformAuditService } from './platform-audit.service';

const VIEW_AS_DURATION_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class ConsoleViewAsService {
  private readonly logger = new Logger(ConsoleViewAsService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private auditService: PlatformAuditService,
  ) {}

  async startSession(
    superAdminId: string,
    superAdminEmail: string,
    originalBusinessId: string,
    targetBusinessId: string,
    reason: string,
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Reason is required for view-as sessions');
    }

    // Check target business exists
    const targetBusiness = await this.prisma.business.findUnique({
      where: { id: targetBusinessId },
      select: { id: true, name: true, slug: true },
    });
    if (!targetBusiness) {
      throw new NotFoundException('Target business not found');
    }

    // Check no active session for this super admin
    const activeSession = await this.prisma.viewAsSession.findFirst({
      where: {
        superAdminId,
        endedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (activeSession) {
      throw new ConflictException('An active view-as session already exists. End it first.');
    }

    const expiresAt = new Date(Date.now() + VIEW_AS_DURATION_MS);

    // Create session
    const session = await this.prisma.viewAsSession.create({
      data: {
        superAdminId,
        targetBusinessId,
        reason: reason.trim(),
        expiresAt,
      },
    });

    // Audit log
    await this.auditService.log(superAdminId, superAdminEmail, 'VIEW_AS_START', {
      targetType: 'BUSINESS',
      targetId: targetBusinessId,
      reason: reason.trim(),
      metadata: { sessionId: session.id },
    });

    // Issue scoped JWT
    const payload = {
      sub: superAdminId,
      email: superAdminEmail,
      businessId: targetBusinessId,
      role: 'ADMIN',
      viewAs: true,
      viewAsSessionId: session.id,
      originalBusinessId,
      originalRole: 'SUPER_ADMIN',
    };

    const accessToken = this.jwt.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwt.sign(payload, { expiresIn: '15m' });

    return {
      sessionId: session.id,
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
      business: {
        id: targetBusiness.id,
        name: targetBusiness.name,
        slug: targetBusiness.slug,
      },
    };
  }

  async endSession(superAdminId: string, superAdminEmail: string, viewAsSessionId?: string) {
    let session;

    if (viewAsSessionId) {
      session = await this.prisma.viewAsSession.findFirst({
        where: { id: viewAsSessionId, superAdminId, endedAt: null },
      });
    } else {
      // Find any active session for this super admin
      session = await this.prisma.viewAsSession.findFirst({
        where: { superAdminId, endedAt: null, expiresAt: { gt: new Date() } },
      });
    }

    if (!session) {
      return { ended: true };
    }

    await this.prisma.viewAsSession.update({
      where: { id: session.id },
      data: { endedAt: new Date() },
    });

    await this.auditService.log(superAdminId, superAdminEmail, 'VIEW_AS_END', {
      targetType: 'BUSINESS',
      targetId: session.targetBusinessId,
      metadata: { sessionId: session.id },
    });

    // Re-issue original Super Admin tokens
    const staff = await this.prisma.staff.findUnique({
      where: { id: superAdminId },
      select: { id: true, email: true, businessId: true, role: true },
    });

    if (!staff) {
      return { ended: true };
    }

    const payload = {
      sub: staff.id,
      email: staff.email,
      businessId: staff.businessId,
      role: staff.role,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, { expiresIn: '7d' });

    return {
      ended: true,
      accessToken,
      refreshToken,
    };
  }

  async getActiveSession(superAdminId: string) {
    const session = await this.prisma.viewAsSession.findFirst({
      where: {
        superAdminId,
        endedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        targetBusiness: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return session || null;
  }

  async validateViewAsSession(sessionId: string): Promise<boolean> {
    const session = await this.prisma.viewAsSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) return false;
    if (session.endedAt) return false;
    if (session.expiresAt < new Date()) return false;

    return true;
  }
}
