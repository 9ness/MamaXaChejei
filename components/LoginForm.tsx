'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/app/admin/actions';
import { AdminPinFlow } from '@/components/AdminPinFlow';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm({ hasPin }: { hasPin: boolean }) {
    const router = useRouter();
    const [usePassword, setUsePassword] = useState(false);
    const [error, setError] = useState('');

    const handlePassword = async (formData: FormData) => {
        const result = await login(formData);
        if (result?.error) setError(result.error);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">
                        {hasPin || usePassword ? 'Acceso Admin' : 'Crear PIN de gestión'}
                    </CardTitle>
                    <CardDescription>
                        {usePassword
                            ? 'Introduce la contraseña para gestionar pedidos.'
                            : 'Este móvil quedará recordado: la próxima vez basta con tocar 5 veces el título de la portada.'}
                    </CardDescription>
                </CardHeader>

                {usePassword ? (
                    <form action={handlePassword}>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="password">Contraseña</Label>
                                <Input id="password" name="password" type="password" required />
                            </div>
                            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                        </CardContent>
                        <CardFooter className="flex-col gap-3">
                            <Button type="submit" className="w-full">Entrar</Button>
                            <button
                                type="button"
                                onClick={() => { setError(''); setUsePassword(false); }}
                                className="text-xs text-muted-foreground underline"
                            >
                                Entrar con PIN
                            </button>
                        </CardFooter>
                    </form>
                ) : (
                    <>
                        <CardContent>
                            <AdminPinFlow hasPin={hasPin} onDone={() => router.refresh()} />
                        </CardContent>
                        {hasPin && (
                            <CardFooter className="justify-center">
                                <button
                                    type="button"
                                    onClick={() => { setError(''); setUsePassword(true); }}
                                    className="text-xs text-muted-foreground underline"
                                >
                                    Non lembro o PIN — usar contrasinal
                                </button>
                            </CardFooter>
                        )}
                    </>
                )}
            </Card>
        </div>
    );
}
