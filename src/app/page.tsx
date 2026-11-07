import { listPublicAccounts } from '@/lib/db';
import { DashboardClient } from '@/components/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const accounts = await listPublicAccounts();
  return <DashboardClient initialAccounts={accounts} />;
}
