import { z } from "zod";

import {
  capacityDuplicateResponse,
  capacityErrorResponse,
  claimAiCapacity,
  settleAiCapacity,
} from "@/lib/ai/guard";
import { analyzeVideoTechnique, videoTechniqueConfig } from "@/lib/ai/video-technique";
import { getUser } from "@/lib/auth/require-user";
import { TECHNIQUE_VIDEO_MAX_BYTES, TECHNIQUE_VIDEO_MIME } from "@/lib/domain/ai/video-technique";
import { getActiveWorkoutForUser } from "@/lib/repos/workouts.repo";

export const runtime = "nodejs";
export const maxDuration = 60;

const querySchema = z.object({
  workoutId: z.uuid(),
  exerciseId: z.uuid(),
  requestId: z.uuid(),
});

async function readMp4(body: ReadableStream<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > TECHNIQUE_VIDEO_MAX_BYTES) {
        void reader.cancel().catch(() => undefined);
        return { error: "video_too_large", status: 413 } as const;
      }
      chunks.push(value);
    }
  } catch {
    return { error: "invalid_video", status: 400 } as const;
  } finally {
    reader.releaseLock();
  }

  const video = Buffer.concat(chunks, size);
  if (size < 16 || video.toString("ascii", 4, 8) !== "ftyp") {
    return { error: "invalid_video", status: 400 } as const;
  }
  return { video };
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const config = videoTechniqueConfig();
  if (!config) return Response.json({ error: "video_unavailable" }, { status: 503 });

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  if (Number(request.headers.get("content-length")) > TECHNIQUE_VIDEO_MAX_BYTES) {
    return Response.json({ error: "video_too_large" }, { status: 413 });
  }
  if (!request.body || request.headers.get("content-type") !== TECHNIQUE_VIDEO_MIME) {
    return Response.json({ error: "invalid_video" }, { status: 400 });
  }

  const { workoutId, exerciseId, requestId } = parsed.data;
  const workout = await getActiveWorkoutForUser(user.id, workoutId);
  const exercise = workout?.exercises.find(({ id }) => id === exerciseId);
  if (workout?.status !== "completed" || !exercise) {
    return Response.json({ error: "exercise_not_found" }, { status: 404 });
  }

  const capacity = await claimAiCapacity({
    userId: user.id,
    operation: "one_shot",
    requestKey: `video-technique:${user.id}:${workoutId}:${exerciseId}:${requestId}`,
    scopeKey: workoutId,
  });
  if (capacity.kind === "duplicate") return capacityDuplicateResponse(capacity);
  if (capacity.kind !== "allowed") return capacityErrorResponse(capacity);

  const upload = await readMp4(request.body);
  if ("error" in upload) {
    await settleAiCapacity(capacity.usageId, false);
    return Response.json({ error: upload.error }, { status: upload.status });
  }

  let analysis: string;
  try {
    analysis = await analyzeVideoTechnique({
      config,
      userId: user.id,
      exercise: exercise.exerciseNameRu,
      video: upload.video,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]),
    });
  } catch (error) {
    console.error("[video-technique] provider failed", error instanceof Error ? error.message : "unknown error");
    await settleAiCapacity(capacity.usageId, false);
    return Response.json({ error: "video_analysis_failed" }, { status: 502 });
  }

  await settleAiCapacity(capacity.usageId, true);
  return Response.json({ analysis }, { headers: { "Cache-Control": "no-store" } });
}
