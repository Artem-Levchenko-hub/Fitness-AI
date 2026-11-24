import { setEffortLabel, type SetEffort } from "@/lib/domain/workouts/effort";
import { cn } from "@/lib/utils";

export function SetEffortBadge({ effort }: { effort?: SetEffort | null }) {
  if (!effort) return null;
  return (
    <span className={cn("ml-2 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold", effort === "near_failure"
      ? "bg-orange-500/15 text-orange-700 dark:text-orange-400"
      : "bg-red-500/15 text-red-700 dark:text-red-400")}>
      {setEffortLabel(effort)}
    </span>
  );
}
