export type CoachConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Keep the newest complete turns inside the provider limits. */
export function fitCoachMessagesForModel<T extends CoachConversationMessage>(
  messages: T[],
  maxMessages = 32,
  maxCharacters = 24_000,
): T[] {
  const selected: T[] = [];
  let characters = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    if (selected.length >= maxMessages) break;
    if (characters + message.content.length > maxCharacters) break;
    selected.push(message);
    characters += message.content.length;
  }

  selected.reverse();
  while (selected[0]?.role === "assistant") selected.shift();
  return selected;
}
