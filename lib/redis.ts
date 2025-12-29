import { Redis } from '@upstash/redis';

const getClient = () => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('⚠️  UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing. Redis functions will fail.');
    // Return a dummy client to prevent crash at module evaluation, but it will fail on requests.
    return new Redis({
      url: 'https://example.com',
      token: 'example_token'
    });
  }

  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
};

export const redis = getClient();
