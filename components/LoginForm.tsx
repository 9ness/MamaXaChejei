'use client';

import { login } from '@/app/admin/actions'; // We will define this next or inline it? Better separate.
// Wait, I can't import server action directly into client component if not defined in 'use server' file. 
// I defined it above in app/admin/actions.ts

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from 'react';

export function LoginForm() {
    const [error, setError] = useState('');

    const handleSubmit = async (formData: FormData) => {
        const result = await login(formData);
        if (result?.error) {
            setError(result.error);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">Acceso Admin</CardTitle>
                    <CardDescription>
                        Introduce la contraseña para gestionar pedidos.
                    </CardDescription>
                </CardHeader>
                <form action={handleSubmit}>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input id="password" name="password" type="password" required />
                        </div>
                        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full">Entrar</Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
