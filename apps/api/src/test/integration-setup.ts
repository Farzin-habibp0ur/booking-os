import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { createMockPrisma, MockPrisma } from './mocks';

const TEST_JWT_SECRET = 'test-secret';

// Set env vars before modules load so ConfigService.get() finds them
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.JWT_EXPIRATION = '15m';
process.env.JWT_REFRESH_EXPIRATION = '7d';

export interface IntegrationTestContext {
  app: INestApplication;
  prisma: MockPrisma;
  jwtService: JwtService;
}

export async function createIntegrationApp(
  modules: any[],
  controllers: any[],
  providers: any[],
): Promise<IntegrationTestContext> {
  const prisma = createMockPrisma();

  const moduleBuilder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      PassportModule.register({ defaultStrategy: 'jwt' }),
      JwtModule.register({
        secret: TEST_JWT_SECRET,
        signOptions: { expiresIn: '15m', algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
      ...modules,
    ],
    controllers,
    providers: [
      ...providers,
      { provide: PrismaService, useValue: prisma },
    ],
  });

  const moduleRef: TestingModule = await moduleBuilder.compile();
  const app = moduleRef.createNestApplication();

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();

  const jwtService = moduleRef.get(JwtService);

  return { app, prisma, jwtService };
}

export function getAuthToken(
  jwtService: JwtService,
  overrides: Partial<{ sub: string; email: string; businessId: string; role: string }> = {},
): string {
  return jwtService.sign({
    sub: overrides.sub ?? 'staff1',
    email: overrides.email ?? 'test@test.com',
    businessId: overrides.businessId ?? 'biz1',
    role: overrides.role ?? 'OWNER',
  });
}
