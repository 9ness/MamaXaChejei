'use client';

import { updateAnnouncement } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Megaphone } from 'lucide-react';
import { useState, useRef } from 'react';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Publicando...' : 'Publicar Anuncio'}
        </Button>
    );
}

export function AnnouncementForm() {
    const [open, setOpen] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    const handleAction = async (formData: FormData) => {
        const text = formData.get('text') as string;
        await updateAnnouncement(text);
        setOpen(false);
        formRef.current?.reset();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 bg-orange-600 hover:bg-orange-700 text-white shadow-md border border-orange-700">
                    <Megaphone className="h-4 w-4" />
                    <span className="hidden sm:inline">Nuevo Anuncio</span>
                    <span className="inline sm:hidden">Anuncio</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Publicar Anuncio</DialogTitle>
                    <DialogDescription>
                        Escribe un mensaje visible para todos. Déjalo vacío para borrar el anuncio actual.
                    </DialogDescription>
                </DialogHeader>
                <form action={handleAction} ref={formRef} className="grid gap-4 py-4">
                    <Textarea
                        id="text"
                        name="text"
                        placeholder="Escribe aquí tu anuncio..."
                        className="min-h-[100px]"
                    />
                    <DialogFooter>
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
