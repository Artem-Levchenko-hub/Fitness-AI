import { BottomTabBar } from "@/components/app/BottomTabBar";
import { GlobalResumeBar } from "@/components/app/GlobalResumeBar";
import { OfflineBanner } from "@/components/app/OfflineBanner";
import { SessionRefreshSync } from "@/components/auth/SessionRefreshSync";
import { SectionNavigation, SectionPages } from "@/components/app/SectionNavigation";
import { requireUser } from "@/lib/auth/require-user";
import { getActiveResumes } from "@/server/actions/active-resumes";
import { getUserProfile } from "@/lib/repos/body.repo";
import { MorningWellnessPrompt } from "@/components/wellness/MorningWellnessPrompt";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Первый кадр полосы возобновления — серверный (корректный SSR). Дальше
  // GlobalResumeBar сам перезапрашивает при навигации: layout client-кэшируется
  // и не ре-рендерится, иначе полоса застыла бы на состоянии загрузки.
  const [initialResumes, profile] = await Promise.all([
    getActiveResumes(),
    getUserProfile(user.id),
  ]);

  return (
    <SectionNavigation>
      <SessionRefreshSync />
      <MorningWellnessPrompt userId={user.id} timeZone={profile?.timezone ?? "Europe/Moscow"} />
      <OfflineBanner />
      <SectionPages>{children}</SectionPages>
      <GlobalResumeBar initial={initialResumes} />
      <BottomTabBar />
    </SectionNavigation>
  );
}
