import { Injectable, Logger } from '@nestjs/common';

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: Date;
  hourlyCount: number;
  hourlyResetTime: Date;
  dailyCount: number;
  dailyResetTime: Date;
}

@Injectable()
export class AiRateLimitService {
  private readonly logger = new Logger(AiRateLimitService.name);
  private readonly rateLimitCache = new Map<string, RateLimitEntry>();

  private readonly defaultLimits: RateLimitConfig = {
    maxRequestsPerMinute: 10,
    maxRequestsPerHour: 100,
    maxRequestsPerDay: 1000,
  };

  async checkRateLimit(
    userId: string,
    operation: string,
    customLimits?: Partial<RateLimitConfig>,
  ): Promise<RateLimitResult> {
    const limits = { ...this.defaultLimits, ...customLimits };
    const now = new Date();
    const cacheKey = `${userId}:${operation}`;

    try {
      const result = this.checkCacheRateLimit(cacheKey, limits, now);

      if (!result.allowed) {
        this.logger.warn(
          `Rate limit exceeded for user ${userId} on operation ${operation}`,
          {
            userId,
            operation,
            remaining: result.remaining,
            resetTime: result.resetTime,
          },
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Error checking rate limit for user ${userId}`, {
        error: error.message,
        operation,
      });
      // On error, allow the request but log the issue
      return {
        allowed: true,
        remaining: 1,
        resetTime: new Date(now.getTime() + 60000), // 1 minute from now
      };
    }
  }

  private checkCacheRateLimit(
    cacheKey: string,
    limits: RateLimitConfig,
    now: Date,
  ): RateLimitResult {
    const cached = this.rateLimitCache.get(cacheKey);

    if (!cached || now >= cached.resetTime) {
      // Reset or create new cache entry
      this.rateLimitCache.set(cacheKey, {
        count: 1,
        resetTime: new Date(now.getTime() + 60000),
        hourlyCount: 1,
        hourlyResetTime: new Date(now.getTime() + 3600000),
        dailyCount: 1,
        dailyResetTime: new Date(now.getTime() + 86400000),
      });

      return {
        allowed: true,
        remaining: limits.maxRequestsPerMinute - 1,
        resetTime: new Date(now.getTime() + 60000),
      };
    }

    // Check if hourly reset is needed
    if (now >= cached.hourlyResetTime) {
      cached.hourlyCount = 1;
      cached.hourlyResetTime = new Date(now.getTime() + 3600000);
    } else {
      cached.hourlyCount++;
    }

    // Check if daily reset is needed
    if (now >= cached.dailyResetTime) {
      cached.dailyCount = 1;
      cached.dailyResetTime = new Date(now.getTime() + 86400000);
    } else {
      cached.dailyCount++;
    }

    // Check if any limit is exceeded
    if (cached.count >= limits.maxRequestsPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: cached.resetTime,
        retryAfter: Math.ceil(
          (cached.resetTime.getTime() - now.getTime()) / 1000,
        ),
      };
    }

    if (cached.hourlyCount >= limits.maxRequestsPerHour) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: cached.hourlyResetTime,
        retryAfter: Math.ceil(
          (cached.hourlyResetTime.getTime() - now.getTime()) / 1000,
        ),
      };
    }

    if (cached.dailyCount >= limits.maxRequestsPerDay) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: cached.dailyResetTime,
        retryAfter: Math.ceil(
          (cached.dailyResetTime.getTime() - now.getTime()) / 1000,
        ),
      };
    }

    // Increment minute count
    cached.count++;
    this.rateLimitCache.set(cacheKey, cached);

    // Calculate remaining requests (use the most restrictive limit)
    const remaining = Math.min(
      limits.maxRequestsPerMinute - cached.count,
      limits.maxRequestsPerHour - cached.hourlyCount,
      limits.maxRequestsPerDay - cached.dailyCount,
    );

    return {
      allowed: true,
      remaining,
      resetTime: cached.resetTime,
    };
  }

  async logRequest(
    userId: string,
    operation: string,
    success: boolean = true,
  ): Promise<void> {
    // In-memory logging only
    this.logger.debug(`AI request logged for user ${userId}`, {
      operation,
      success,
    });
  }

  async getRateLimitStatus(
    userId: string,
    operation: string,
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(userId, operation);
  }

  async resetRateLimit(userId: string, operation: string): Promise<void> {
    const cacheKey = `${userId}:${operation}`;
    this.rateLimitCache.delete(cacheKey);

    this.logger.log(
      `Rate limit reset for user ${userId} on operation ${operation}`,
    );
  }

  // Cleanup expired entries periodically
  cleanupExpiredEntries(): void {
    const now = new Date();
    for (const [key, entry] of this.rateLimitCache.entries()) {
      if (now >= entry.dailyResetTime) {
        this.rateLimitCache.delete(key);
      }
    }
  }

  // Get cache statistics for monitoring
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.rateLimitCache.size,
      keys: Array.from(this.rateLimitCache.keys()),
    };
  }
}
