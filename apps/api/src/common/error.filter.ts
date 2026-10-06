import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { t } from '@sba/shared';
import type { Request, Response } from 'express';

import { AppError, ERROR_CODES, fromDatabaseError } from './app-error.js';

export interface ErrorBody {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly fields?: readonly string[];
}

function fromHttpException(exception: HttpException): AppError {
  if (exception instanceof ThrottlerException) return new AppError('RATE_LIMITED');
  switch (exception.getStatus()) {
    case 400:
      return new AppError('VALIDATION');
    case 401:
      return new AppError('UNAUTHENTICATED');
    case 403:
      return new AppError('FORBIDDEN');
    case 404:
      return new AppError('NOT_FOUND');
    case 429:
      return new AppError('RATE_LIMITED');
    default:
      return new AppError('INTERNAL');
  }
}

/**
 * One error envelope for every failure: a stable code, an Arabic message and the
 * request id. Stack traces, SQL and internal identifiers never reach the client.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Error');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = request.ctx?.requestId ?? '-';

    const error =
      exception instanceof AppError
        ? exception
        : exception instanceof HttpException
          ? fromHttpException(exception)
          : (fromDatabaseError(exception) ?? new AppError('INTERNAL'));

    if (error.code === 'INTERNAL') {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.path}`,
        exception instanceof Error ? exception.stack : exception,
      );
    }

    const definition = ERROR_CODES[error.code];
    const body: ErrorBody = {
      code: error.code,
      message: t(definition.message, error.params),
      requestId,
      ...(error.fields ? { fields: error.fields } : {}),
    };
    response.status(definition.status).json(body);
  }
}
