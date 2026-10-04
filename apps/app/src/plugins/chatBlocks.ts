/**
 * Pure rules of the plugin chat (no React Native here, so `bun test` covers them): consecutive messages of one person
 * form one block, however far apart in time, so the block shows its author's name and initials once.
 */
type Author = { person: string; mine?: boolean };

/** Where a message sits in its block: `first` gets the author's name above it, `last` the initials beside it. */
export type BlockPlace = { first: boolean; last: boolean };

const sameAuthor = (a: Author | undefined, b: Author | undefined) =>
  a !== undefined && b !== undefined && a.person === b.person && Boolean(a.mine) === Boolean(b.mine);

export const blockPlaces = (messages: Author[]): BlockPlace[] =>
  messages.map((message, i) => ({
    first: !sameAuthor(messages[i - 1], message),
    last: !sameAuthor(message, messages[i + 1]),
  }));
