import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter (Throttling / 429)', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      header: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      getHeaders: jest.fn().mockReturnValue({}),
    };
    mockRequest = {
      url: '/auth/login',
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;
  });

  it('should handle ThrottlerException and format standard 429 payload with Retry-After header', () => {
    mockResponse.getHeaders.mockReturnValue({
      'retry-after': 60,
    });

    const throttlerException = new ThrottlerException(
      'Rate limit exceeded. Maximum 5 requests allowed per window. Please try again after 60 seconds.',
    );

    filter.catch(throttlerException, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect(mockResponse.header).toHaveBeenCalledWith('Retry-After', 60);
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 429,
        path: '/auth/login',
        retryAfter: 60,
        message: expect.stringContaining('Rate limit exceeded'),
      }),
    );
  });

  it('should extract retryAfter when present in exception response object', () => {
    const customException = {
      getStatus: () => 429,
      getResponse: () => ({
        statusCode: 429,
        message: 'Account locked for 15 minutes',
        retryAfter: 900,
      }),
    };
    Object.setPrototypeOf(
      customException,
      require('@nestjs/common').HttpException.prototype,
    );

    filter.catch(customException, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(mockResponse.header).toHaveBeenCalledWith('Retry-After', 900);
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 429,
        retryAfter: 900,
        message: 'Account locked for 15 minutes',
      }),
    );
  });
});
