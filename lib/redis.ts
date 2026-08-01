import Redis from "ioredis";

function createRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return new Redis(url, {
    maxRetriesPerRequest: null,
    retryStrategy: (attempt: number) => Math.min(attempt * 200, 5_000),
  });
}

export const redis = createRedis();
