describe('PrismaService buildDatasourceUrl', () => {
  const originalEnv = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = originalEnv;
    jest.resetModules();
  });

  function loadModule() {
    // Prevent actual PrismaClient connection
    jest.mock('@booking-os/db', () => ({
      PrismaClient: class MockPrismaClient {
        private datasourceUrl: string;
        constructor(opts?: any) {
          this.datasourceUrl = opts?.datasources?.db?.url || '';
        }
        getDatasourceUrl() {
          return this.datasourceUrl;
        }
        $connect() {
          return Promise.resolve();
        }
        $disconnect() {
          return Promise.resolve();
        }
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./prisma.service');
  }

  it('appends connection_limit and pool_timeout to DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db?schema=public';
    const { PrismaService } = loadModule();
    const service = new PrismaService();
    const url = (service as any).datasourceUrl;
    expect(url).toContain('connection_limit=10');
    expect(url).toContain('pool_timeout=10');
  });

  it('appends statement_timeout as PostgreSQL connection option', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db?schema=public';
    const { PrismaService } = loadModule();
    const service = new PrismaService();
    const url = (service as any).datasourceUrl;
    expect(url).toContain('statement_timeout');
  });

  it('does not override existing connection_limit', () => {
    process.env.DATABASE_URL =
      'postgresql://user:pass@host:5432/db?schema=public&connection_limit=20';
    const { PrismaService } = loadModule();
    const service = new PrismaService();
    const url = (service as any).datasourceUrl;
    // Should keep the existing value
    expect(url).toContain('connection_limit=20');
    expect(url).not.toContain('connection_limit=10');
  });
});
