import { Redis } from '@upstash/redis';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Manual .env.local parsing function
function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error(`❌ Error: El archivo .env.local no existe.`);
        process.exit(1);
    }
    try {
        let content = fs.readFileSync(envPath, 'utf-8');
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

        const envVars: Record<string, string> = {};
        content.split(/\r?\n/).forEach(line => {
            const cleanLine = line.trim();
            if (!cleanLine || cleanLine.startsWith('#')) return;
            const splitIndex = cleanLine.indexOf('=');
            if (splitIndex === -1) return;
            const key = cleanLine.substring(0, splitIndex).trim();
            let value = cleanLine.substring(splitIndex + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            envVars[key] = value;
        });
        return envVars;
    } catch (error) {
        console.error(`❌ Error leyendo .env.local:`, error);
        process.exit(1);
    }
}

const env = loadEnv();
const url = env['UPSTASH_REDIS_REST_URL'];
const token = env['UPSTASH_REDIS_REST_TOKEN'];

if (!url || !token) {
    console.error("❌ Error Redis credentials missing");
    process.exit(1);
}

const redis = new Redis({ url, token });

const NAMESPACE = 'fiesta';
const MEMBERS_KEY = `${NAMESPACE}:miembros_ids`;

// Extended Data Model: apellido1, apellido2
const SAMPLE_MEMBERS = [
    { nombre: "Carlos", apellido1: "García", apellido2: "Pérez", talla: "L", pagado: true, recogido: false },
    { nombre: "Ana", apellido1: "Martínez", apellido2: "López", talla: "M", pagado: true, recogido: true },
    { nombre: "Luis", apellido1: "Rodríguez", apellido2: "", talla: "XL", pagado: false, recogido: false },
    { nombre: "María", apellido1: "López", apellido2: "Díaz", talla: "S", pagado: false, recogido: false },
    { nombre: "Javier", apellido1: "Sánchez", apellido2: "Ruiz", talla: "XXL", pagado: true, recogido: false },
    { nombre: "Elena", apellido1: "Fernández", apellido2: "Gómez", talla: "M", pagado: true, recogido: true },
    { nombre: "Pedro", apellido1: "Gómez", apellido2: "Martín", talla: "L", pagado: false, recogido: false },
    { nombre: "Lucía", apellido1: "Díaz", apellido2: "Moreno", talla: "S", pagado: true, recogido: false },
    { nombre: "Miguel", apellido1: "Torres", apellido2: "Jiménez", talla: "3XL", pagado: false, recogido: false },
    { nombre: "Sofía", apellido1: "Ruiz", apellido2: "Navarro", talla: "M", pagado: true, recogido: true },
];

async function seed() {
    console.log("🌱 Starting seed...");

    const oldIds = await redis.smembers(MEMBERS_KEY);
    if (oldIds.length > 0) {
        const pipeline = redis.pipeline();
        pipeline.del(MEMBERS_KEY);
        oldIds.forEach((id: string) => {
            pipeline.del(`${NAMESPACE}:miembro:${id}`);
        });
        await pipeline.exec();
        console.log(`🧹 Cleared ${oldIds.length} existing records.`);
    }

    const pipeline = redis.pipeline();

    for (const m of SAMPLE_MEMBERS) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        // Schema matching app/actions.ts
        const memberData = {
            id,
            nombre: m.nombre,
            apellido1: m.apellido1,
            apellido2: m.apellido2 || '',
            talla: m.talla,
            pagado: m.pagado,
            fechaPagado: m.pagado ? now : '',
            recogido: m.recogido,
            fechaRecogido: m.recogido ? now : '',
        };

        pipeline.sadd(MEMBERS_KEY, id);
        pipeline.hset(`${NAMESPACE}:miembro:${id}`, memberData);
    }

    await pipeline.exec();
    console.log(`✅ Seeded ${SAMPLE_MEMBERS.length} members successfully!`);
}

seed().catch((err) => {
    console.error("Error seeding:", err);
    process.exit(1);
});
