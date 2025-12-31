
import { Redis } from '@upstash/redis'
import * as dotenv from 'dotenv'

dotenv.config()

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
    throw new Error('UPSTASH vars missing')
}

const redis = new Redis({ url, token })

async function forceReset() {
    console.log('--- Force Resetting High Score ---');

    // Custom "Zero" record
    const zeroRecord = { name: 'Nadie', score: 0 };

    console.log(`Overwriting fiesta:highscore with:`, zeroRecord);
    await redis.set('fiesta:highscore', JSON.stringify(zeroRecord));

    // Verify
    const result = await redis.get('fiesta:highscore');
    console.log('Verification read:', result);

    // Re-verify Total Games logic if needed, but user said it updated.
    // Just in case, let's ensure it exists.
    const total = await redis.get('fiesta:total_games');
    console.log('Current Total Games:', total);

    console.log('--- Done ---');
}

forceReset().catch(console.error);
