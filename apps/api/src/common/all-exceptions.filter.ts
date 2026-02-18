import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Sentry is optional — only capture if initialized
let Sentry: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sentry = require('@sentry/nestjs');
} catch {
  // Sentry not installed — skip
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, any>;
        message = res.message || exception.message;
        error = res.error || exception.name;
      } else {
        message = exception.message;
        error = exception.name;
      }
    } else if (exception instanceof Error) {
      // Log the full error for debugging but don't expose it to clients
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);

      // Report to Sentry if available
      if (Sentry?.captureException) {
        Sentry.captureException(exception);
      }

      // Check for Prisma errors to return appropriate status codes
      if (exception.constructor.name === 'PrismaClientKnownRequestError') {
        const prismaError = exception as any;
        const code = prismaError.code || 'UNKNOWN';
        this.logger.error(`Prisma error ${code}: ${prismaError.message}`, prismaError.meta);
        status = HttpStatus.BAD_REQUEST;
        error = 'Bad Request';

        // Provide user-friendly messages based on Prisma error code
        switch (code) {
          case 'P2002':
            message = 'A record with this data already exists';
            break;
          case 'P2003':
            message = 'Referenced record not found — a related item may have been deleted';
            break;
          case 'P2025':
            message = 'Record not found';
            break;
          default:
            message = `Database operation failed (${code})`;
        }
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
