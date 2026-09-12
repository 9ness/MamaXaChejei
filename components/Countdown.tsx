'use client';

import { useEffect, useState } from 'react';

interface TimeLeft {
    months: number;
    weeks: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

export function Countdown() {
    // O Chupitaso: as doce da noite do venres 11 ao sábado 12. Se cambia o
    // cartel, hai que tocar isto E lib/itinerario.ts.
    const targetDate = new Date('2026-09-12T00:00:00');
    const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // null = xa pasou a hora. Entón o contador non se amosa: quedar a cero
        // na portada durante toda a festa non dicía nada a ninguén.
        const calcular = (): TimeLeft | null => {
            const now = new Date();
            let difference = targetDate.getTime() - now.getTime();

            // Adjust for timezone offset differences (DST) to prevent "losing" an hour
            // If we are in CET (-60) and target is CEST (-120), we need to add 60 minutes to match wall-clock expectations
            const offsetDiff = (now.getTimezoneOffset() - targetDate.getTimezoneOffset()) * 60 * 1000;
            difference += offsetDiff;

            if (difference <= 0) return null;

            // Approximate calculation
            const totalDays = Math.floor(difference / (1000 * 60 * 60 * 24));

            // Approximate months (30.44 days per month)
            const months = Math.floor(totalDays / 30.44);
            const remainingDaysAfterMonths = totalDays - Math.floor(months * 30.44);

            const weeks = Math.floor(remainingDaysAfterMonths / 7);
            const days = Math.floor(remainingDaysAfterMonths % 7);

            const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((difference / 1000 / 60) % 60);
            const seconds = Math.floor((difference / 1000) % 60);

            return { months, weeks, days, hours, minutes, seconds };
        };

        setMounted(true);
        setTimeLeft(calcular());
        const timer = setInterval(() => {
            const t = calcular();
            setTimeLeft(t);
            if (!t) clearInterval(timer);
        }, 1000);

        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!mounted || !timeLeft) return null;

    const TimeBox = ({ value, label }: { value: number, label: string }) => (
        <div className="flex flex-col items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg p-2 md:p-3 shadow-sm border border-slate-200 dark:border-slate-800 min-w-[50px] md:min-w-[70px]">
            <span className="text-xl md:text-3xl font-black text-primary bg-clip-text text-transparent bg-gradient-to-b from-primary to-purple-600">
                {String(value).padStart(2, '0')}
            </span>
            <span className="text-[9px] md:text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                {label}
            </span>
        </div>
    );

    return (
        <div className="flex flex-wrap justify-center gap-2 md:gap-4 my-6 py-4">
            <TimeBox value={timeLeft.months} label="Meses" />
            <TimeBox value={timeLeft.weeks} label="Sem" />
            <TimeBox value={timeLeft.days} label="Días" />
            <TimeBox value={timeLeft.hours} label="Horas" />
            <TimeBox value={timeLeft.minutes} label="Min" />
            <TimeBox value={timeLeft.seconds} label="Seg" />
        </div>
    );
}
