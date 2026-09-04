import { Redis } from '@upstash/redis'
import { randomBytes, scryptSync } from 'crypto'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

// Pone el PIN de admin directamente en Redis. Es el camino de arranque cuando
// no recuerdas el ADMIN_PASSWORD: uso `npx tsx scripts/set-admin-pin.ts 1234`.
// Tiene que escribir EXACTAMENTE lo mismo que lib/admin-pin.ts (HASH con
// {salt, hash} y scrypt de 32 bytes) o la app no lo reconocerá.
const PIN_KEY = 'fiesta:admin_pin'
const SECRET_KEY = 'fiesta:admin_secret'

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

if (!url || !token) {
    throw new Error('Faltan UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN (mira .env.local)')
}

const pin = process.argv[2]

if (!pin || !/^\d{4}$/.test(pin)) {
    throw new Error('Uso: npx tsx scripts/set-admin-pin.ts <4 dígitos>')
}

const redis = new Redis({ url, token })

async function main() {
    const salt = randomBytes(16).toString('hex')
    const hash = scryptSync(pin, salt, 32).toString('hex')

    await redis.hset(PIN_KEY, { salt, hash })

    // Invalida las sesiones abiertas: si alguien había entrado con el PIN viejo
    // (o con la cookie falsificable de antes), se queda fuera.
    await redis.del(SECRET_KEY)

    console.log('✅ PIN de admin actualizado. Sesiones anteriores cerradas.')
}

main()
