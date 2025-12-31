
import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function GET() {
    try {
        console.log('API Reset: Deleting fiesta:highscore');
        await redis.del('fiesta:highscore');

        // Optional: Force set to 0 to be sure
        const zeroRecord = { name: 'Nadie', score: 0 };
        await redis.set('fiesta:highscore', JSON.stringify(zeroRecord));

        revalidatePath('/');

        return NextResponse.json({ success: true, message: 'High score reset to 0' });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
