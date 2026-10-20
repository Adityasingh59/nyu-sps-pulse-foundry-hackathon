import type { Query, Restaurant } from "./types";

/** Neutral templates test preferences; they do not assert the target satisfies them. */
export function generateQuestions(restaurant: Restaurant): Query[] {
  const identities = [restaurant.name, ...restaurant.aliases].filter(Boolean);
  const containsIdentity = (value: string) =>
    identities.some((identity) =>
      value.toLocaleLowerCase().includes(identity.toLocaleLowerCase()),
    );
  const proposedLocality = restaurant.location.trim().replace(/[.!?]+$/, "");
  const locality =
    proposedLocality && !containsIdentity(proposedLocality)
      ? proposedLocality
      : "the neighborhood";
  const proposedCuisine = restaurant.cuisine?.trim();
  const cuisine =
    proposedCuisine && !containsIdentity(proposedCuisine)
      ? proposedCuisine
      : "seasonal";
  const templates: [string, string[]][] = [
    [
      `Where can I get lunch near ${locality} for under $20?`,
      ["price", "lunch", "locality"],
    ],
    [
      `What are affordable dinner options in ${locality}?`,
      ["price", "dinner", "locality"],
    ],
    [
      `Which restaurants near ${locality} offer good value for a casual meal?`,
      ["price", "occasion"],
    ],
    [
      `Where can two people eat near ${locality} on a $50 food budget?`,
      ["price", "occasion"],
    ],
    [
      `What are some ${cuisine} restaurants near ${locality}?`,
      ["cuisine", "locality"],
    ],
    [
      `Where can I find locally inspired cooking in ${locality}?`,
      ["cuisine", "locality"],
    ],
    [
      `Which restaurants in ${locality} have a varied menu for different tastes?`,
      ["cuisine", "group"],
    ],
    [
      `Where can I find a relaxed weeknight dinner in ${locality}?`,
      ["occasion", "dinner"],
    ],
    [
      `What are quiet dinner options near ${locality}?`,
      ["occasion", "atmosphere"],
    ],
    [
      `Where should a small group go for lunch in ${locality}?`,
      ["occasion", "group"],
    ],
    [
      `Which places near ${locality} are suitable for a casual date?`,
      ["occasion", "atmosphere"],
    ],
    [
      `What are convenient places to eat before an evening event in ${locality}?`,
      ["occasion", "locality"],
    ],
    [
      `What are some restaurants within walking distance of ${locality}?`,
      ["distance", "locality"],
    ],
    [
      `Where can a visitor get a sit-down lunch around ${locality}?`,
      ["locality", "lunch"],
    ],
    [
      `What neighborhood restaurants would you suggest to someone visiting ${locality}?`,
      ["locality", "discovery"],
    ],
    [
      `Where can a group find vegetarian lunch near ${locality}?`,
      ["preference", "vegetarian", "lunch"],
    ],
    [
      `Which restaurants near ${locality} publish menu information for dietary preferences?`,
      ["preference", "menu"],
    ],
    [
      `Where can diners find clearly listed prices and a current menu in ${locality}?`,
      ["preference", "price", "menu"],
    ],
    [
      `What are good options near ${locality} for a group with mixed dietary preferences?`,
      ["preference", "group"],
    ],
    [
      `Which restaurants in ${locality} make it easy to check opening hours before visiting?`,
      ["preference", "hours"],
    ],
  ];
  return templates.map(([text, intents], index) => ({
    id: `q-${String(index + 1).padStart(2, "0")}`,
    text,
    intents,
    branded: false,
  }));
}
