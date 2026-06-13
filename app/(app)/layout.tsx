import { BottomTabBar } from "@/components/app/BottomTabBar";
import { GlobalResumeBar } from "@/components/app/GlobalResumeBar";
import { SessionRefreshSync } from "@/components/auth/SessionRefreshSync";
import { requireUser } from "@/lib/auth/require-user";
import { getActiveResumes } from "@/server/actions/active-resumes";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  // Первый кадр полосы возобновления — серверный (корректный SSR). Дальше
  // GlobalResumeBar сам перезапрашивает при навигации: layout client-кэшируется
  // и не ре-рендерится, иначе полоса застыла бы на состоянии загрузки.
  const initialResumes = await getActiveResumes();

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <SessionRefreshSync />
      <div className="flex-1 pb-20">{children}</div>
      <GlobalResumeBar initial={initialResumes} />
      <BottomTabBar />
    </div>
  );
}
