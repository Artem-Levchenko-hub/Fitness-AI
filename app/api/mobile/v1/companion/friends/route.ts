import { revalidatePath } from "next/cache";
import { z } from "zod";

import { friendDisplayName, friendEventFormat, friendEventMeta } from "@/lib/domain/friends/friend-activity";
import {
  acceptFriendRequest,
  findUserByEmail,
  getShareProgramsWithFriends,
  listFriendsActivity,
  listIncomingRequestsDetailed,
  listOutgoingRequestsDetailed,
  sendFriendRequest,
  setShareProgramsWithFriends,
  type FriendshipWithUser,
} from "@/lib/repos/friends.repo";
import { friendRequestSchema } from "@/server/schemas/friends";

import { accountIdSchema, companionJson, companionMutation, entityIdSchema, withCompanionUser } from "../response";

export const dynamic = "force-dynamic";

const mutation = z.discriminatedUnion("action", [
  friendRequestSchema.extend({ accountId: accountIdSchema, action: z.literal("invite") }),
  z.object({ accountId: accountIdSchema, action: z.literal("accept"), id: entityIdSchema }),
  z.object({ accountId: accountIdSchema, action: z.literal("share"), enabled: z.boolean() }),
]);

function requestRow({ friendshipId, user }: FriendshipWithUser) {
  return { id: friendshipId, name: friendDisplayName(user), email: user.email };
}

export function GET() {
  return withCompanionUser(async (user) => {
    const [friends, incoming, outgoing, sharesPrograms] = await Promise.all([
      listFriendsActivity(user.id), listIncomingRequestsDetailed(user.id),
      listOutgoingRequestsDetailed(user.id), getShareProgramsWithFriends(user.id),
    ]);
    return companionJson({
      accountId: user.id,
      sharesPrograms,
      incoming: incoming.map(requestRow),
      outgoing: outgoing.map(requestRow),
      friends: friends.map(({ user: friend, lastEvent }) => ({
        id: friend.id,
        name: friendDisplayName(friend),
        email: friend.email,
        lastEvent: lastEvent ? {
          name: lastEvent.name,
          startedAt: lastEvent.startedAt,
          format: friendEventFormat(lastEvent),
          meta: friendEventMeta(lastEvent),
        } : null,
      })),
    });
  });
}

export function POST(request: Request) {
  return companionMutation(request, mutation, async (user, input) => {
    switch (input.action) {
      case "invite": {
        if (input.email === user.email.toLowerCase()) return companionJson({ error: "own_email" }, 400);
        const target = await findUserByEmail(input.email);
        if (!target) return companionJson({ error: "friend_not_found" }, 404);
        await sendFriendRequest(user.id, target.id);
        break;
      }
      case "accept":
        if (!(await acceptFriendRequest(user.id, input.id))) {
          return companionJson({ error: "request_not_found" }, 404);
        }
        break;
      case "share":
        await setShareProgramsWithFriends(user.id, input.enabled);
        break;
    }
    revalidatePath("/friends");
    revalidatePath("/dashboard");
    return companionJson({ ok: true });
  });
}
