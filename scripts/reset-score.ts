
import { Redis } from '@upstash/redis'
import * as dotenv from 'dotenv'

dotenv.config()

// Check for UPSTASH vars matching lib/redis.ts
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be defined in .env')
}

const redis = new Redis({
    url,
    token,
})

async function reset() {
    console.log('Connecting to Redis...');

    // 1. Reset High Score
    console.log('Resetting high score (fiesta:highscore)...');
    await redis.del('fiesta:highscore');

    // 2. Reset Total Games (Fix stuck counter by clearing it)
    console.log('Resetting total games (fiesta:total_games)...');
    await redis.del('fiesta:total_games');

    console.log('Operations complete. Keys deleted.');
}

reset().catch(console.error);
