import { BottomTabBar } from "@/components/app/BottomTabBar";
import { requireUser } from "@/lib/auth/require-user";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <div className="flex-1 pb-20">{children}</div>
      <BottomTabBar />
    </div>
  );
}
