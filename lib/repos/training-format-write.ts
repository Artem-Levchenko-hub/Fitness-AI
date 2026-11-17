export type FormatWriteCode =
  | "workout_not_found"
  | "workout_status_conflict"
  | "template_not_found"
  | "block_not_found"
  | "exercise_not_found"
  | "round_out_of_range";

export class FormatWriteError extends Error {
  constructor(readonly code: FormatWriteCode, message: string) {
    super(message);
    this.name = "FormatWriteError";
  }
}

export type FormatStartOptions = { clientWorkoutId?: string };

export type FormatTransition =
  | "changed"
  | "already_applied"
  | "workout_not_found"
  | "workout_status_conflict";
