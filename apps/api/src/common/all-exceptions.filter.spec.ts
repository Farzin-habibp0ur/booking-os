import { AllExceptionsFilter } from './all-exceptions.filter';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';

function createMockHost(overrides: any = {}) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => ({ status, ...overrides.response }),
        getRequest: () => ({ url: '/test', ...overrides.request }),
      }),
    } as unknown as ArgumentsHost,
    status,
    json,
  };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('handles HttpException', () => {
    const { host, status, json } = createMockHost();
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'Not Found' }),
    );
  });

  it('handles generic Error as 500', () => {
    const { host, status, json } = createMockHost();

    filter.catch(new Error('Unexpected'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Internal server error' }),
    );
  });

  it('handles PrismaClientKnownRequestError P2002 (unique constraint)', () => {
    const { host, status, json } = createMockHost();
    class PrismaClientKnownRequestError extends Error {
      code = 'P2002';
      meta = { target: ['email'] };
      constructor() {
        super('Unique constraint failed');
        this.name = 'PrismaClientKnownRequestError';
      }
    }

    filter.catch(new PrismaClientKnownRequestError(), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'A record with this data already exists' }),
    );
  });

  it('handles PrismaClientKnownRequestError P2003 (FK constraint)', () => {
    const { host, status, json } = createMockHost();
    class PrismaClientKnownRequestError extends Error {
      code = 'P2003';
      meta = { field_name: 'customerId' };
      constructor() {
        super('Foreign key constraint failed');
        this.name = 'PrismaClientKnownRequestError';
      }
    }

    filter.catch(new PrismaClientKnownRequestError(), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Referenced record not found — a related item may have been deleted',
      }),
    );
  });

  it('handles PrismaClientKnownRequestError P2025 (not found)', () => {
    const { host, status, json } = createMockHost();
    class PrismaClientKnownRequestError extends Error {
      code = 'P2025';
      constructor() {
        super('Record to update not found');
        this.name = 'PrismaClientKnownRequestError';
      }
    }

    filter.catch(new PrismaClientKnownRequestError(), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Record not found' }));
  });

  it('handles unknown Prisma error code with fallback message', () => {
    const { host, json } = createMockHost();
    class PrismaClientKnownRequestError extends Error {
      code = 'P2010';
      constructor() {
        super('Raw query failed');
        this.name = 'PrismaClientKnownRequestError';
      }
    }

    filter.catch(new PrismaClientKnownRequestError(), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Database operation failed (P2010)' }),
    );
  });

  it('includes timestamp and path in response', () => {
    const { host, json } = createMockHost();

    filter.catch(new Error('test'), host);

    const response = json.mock.calls[0][0];
    expect(response.timestamp).toBeDefined();
    expect(response.path).toBe('/test');
  });
});
