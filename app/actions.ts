'use server';

import { redis } from '@/lib/redis';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Schema for Member validation
const MemberSchema = z.object({
    id: z.string(),
    nombre: z.string().min(2, "El nombre es obligatorio"),
    apellido1: z.string().min(2, "El apellido 1 es obligatorio"),
    apellido2: z.string().optional(),
    talla: z.enum(['S', 'M', 'L', 'XL', 'XXL', '3XL']),
    pagado: z.boolean().default(false),
    fechaPagado: z.string().optional(),
    recogido: z.boolean().default(false),
    fechaRecogido: z.string().optional(),
});

export type Member = z.infer<typeof MemberSchema>;

const NAMESPACE = 'fiesta';
const MEMBERS_KEY = `${NAMESPACE}:miembros_ids`; // Set of IDs used as index

export async function getMembers(): Promise<Member[]> {
    try {
        const ids = await redis.smembers(MEMBERS_KEY);
        if (!ids || ids.length === 0) return [];

        const pipeline = redis.pipeline();
        ids.forEach(id => {
            pipeline.hgetall(`${NAMESPACE}:miembro:${id}`);
        });

        const results = await pipeline.exec<Member[]>();
        const members = results.filter(m => m !== null && Object.keys(m).length > 0) as Member[];

        const formattedMembers = members.map(m => ({
            ...m,
            pagado: String(m.pagado) === 'true',
            recogido: String(m.recogido) === 'true',
        }));

        return formattedMembers.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (error) {
        console.error('Failed to fetch members:', error);
        return [];
    }
}

export async function addMember(formData: FormData) {
    const nombre = formData.get('nombre') as string;
    const apellido1 = formData.get('apellido1') as string;
    const apellido2 = formData.get('apellido2') as string;
    const talla = formData.get('talla') as string;

    const id = crypto.randomUUID();

    const newMember: Member = {
        id,
        nombre,
        apellido1,
        apellido2: apellido2 || '',
        talla: talla as any,
        pagado: false,
        fechaPagado: '',
        recogido: false,
        fechaRecogido: '',
    };

    const parseResult = MemberSchema.safeParse(newMember);
    if (!parseResult.success) {
        return { msg: 'Datos inválidos' };
    }

    try {
        const pipeline = redis.pipeline();
        pipeline.sadd(MEMBERS_KEY, id);
        pipeline.hset(`${NAMESPACE}:miembro:${id}`, newMember);
        await pipeline.exec();

        revalidatePath('/');
        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        console.error('Failed to add member:', error);
        return { msg: 'Error al guardar en base de datos' };
    }
}

export async function bulkAddMembers(textData: string) {
    try {
        const lines = textData.split('\n').filter(line => line.trim() !== '');
        const pipeline = redis.pipeline();
        let count = 0;

        for (const line of lines) {
            // Format: Nombre Apellido1 Apellido2 Talla
            const parts = line.trim().split(/\s+/);
            if (parts.length < 3) continue; // Minimum: Nombre Apellido1 Talla

            const talla = parts.pop()?.toUpperCase(); // Last part is always Talla
            const apellido2 = parts.length >= 3 ? parts.pop() : ''; // If plenty parts, second to last is apellido2
            const apellido1 = parts.pop();
            const nombre = parts.join(' '); // Remainder is Name (can be composite)

            if (!talla || !apellido1 || !nombre) continue;

            const id = crypto.randomUUID();
            const newMember: Member = {
                id,
                nombre,
                apellido1,
                apellido2: apellido2 || '',
                talla: talla as any,
                pagado: false,
                fechaPagado: '',
                recogido: false,
                fechaRecogido: '',
            };

            pipeline.sadd(MEMBERS_KEY, id);
            pipeline.hset(`${NAMESPACE}:miembro:${id}`, newMember);
            count++;
        }

        if (count > 0) {
            await pipeline.exec();
            revalidatePath('/');
            revalidatePath('/admin');
        }
        return { success: true, count };
    } catch (error) {
        console.error('Failed to bulk add:', error);
        return { error: 'Error en carga masiva' };
    }
}

export async function deleteAllMembers() {
    try {
        const ids = await redis.smembers(MEMBERS_KEY);
        if (ids.length > 0) {
            const pipeline = redis.pipeline();
            pipeline.del(MEMBERS_KEY);
            ids.forEach(id => {
                pipeline.del(`${NAMESPACE}:miembro:${id}`);
            });
            await pipeline.exec();
        }
        revalidatePath('/');
        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete all:', error);
        return { error: 'Error al borrar todo' };
    }
}

export async function toggleStatus(id: string, field: 'pagado' | 'recogido', currentValue: boolean) {
    try {
        const memberKey = `${NAMESPACE}:miembro:${id}`;
        const newValue = !currentValue;
        const now = new Date().toISOString();
        const dateField = field === 'pagado' ? 'fechaPagado' : 'fechaRecogido';
        const dateValue = newValue ? now : '';

        await redis.hset(memberKey, {
            [field]: newValue,
            [dateField]: dateValue
        });

        revalidatePath('/');
        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        console.error(`Failed to toggle ${field}:`, error);
        throw new Error(`Failed to toggle ${field}`);
    }
}

const ANNOUNCEMENT_KEY = `${NAMESPACE}:anuncio`;

export async function getAnnouncement() {
    try {
        const text = await redis.get(ANNOUNCEMENT_KEY);
        return text || '';
    } catch (error) {
        console.error('Failed to get announcement:', error);
        return '';
    }
}

export async function updateAnnouncement(text: string) {
    try {
        if (!text.trim()) {
            await redis.del(ANNOUNCEMENT_KEY);
        } else {
            await redis.set(ANNOUNCEMENT_KEY, text);
        }
        revalidatePath('/');
        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        console.error('Failed to update announcement:', error);
        return { success: false, error: 'Error al actualizar el anuncio' };
    }
}
