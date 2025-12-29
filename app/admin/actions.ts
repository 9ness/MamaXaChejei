'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
    const password = formData.get('password');

    if (password === process.env.ADMIN_PASSWORD) {
        (await cookies()).set('auth', 'true', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: '/',
        });
        redirect('/admin');
    } else {
        return { error: 'Contraseña incorrecta' };
    }
}

export async function logout() {
    (await cookies()).delete('auth');
    redirect('/');
}
