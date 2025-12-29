import { getMembers } from '@/app/actions';
import { MemberList } from '@/components/MemberList';
import { Suspense } from 'react';

import { Header } from '@/components/Header';

import { AnnouncementBanner } from '@/components/AnnouncementBanner';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const members = await getMembers();

  return (
    <main className="min-h-screen bg-gray-50/50 dark:bg-zinc-950">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <Header />

        <Suspense fallback={<div className="text-center p-10">Cargando lista...</div>}>
          <MemberList initialMembers={members} isAdmin={false} />
        </Suspense>
      </div>
    </main>
  );
}
