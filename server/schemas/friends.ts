import { z } from "zod";

/** Заявка в друзья по email. Email нормализуем в нижний регистр — magic-link
 *  логин хранит адреса в нижнем регистре, поэтому ищем по нормализованному. */
export const friendRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Укажите email друга")
    .email("Неверный формат email"),
});

export type FriendRequestInput = z.input<typeof friendRequestSchema>;
