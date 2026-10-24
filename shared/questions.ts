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
      : "local";
  if (restaurant.businessType === "business") {
    const proposedCategory = restaurant.category?.trim();
    const category =
      proposedCategory && !containsIdentity(proposedCategory)
        ? proposedCategory
        : "businesses";
    const scope =
      restaurant.location.trim() && !containsIdentity(restaurant.location)
        ? ` in ${locality}`
        : "";
    // No invented locality, currency, product, or restaurant suitability.
    // These are editable discovery questions, not claims about the target.
    const templates: [string, string[]][] = [
      [
        `Which ${category}${scope} would you recommend to a first-time customer?`,
        ["discovery", "audience"],
      ],
      [
        `What are well-documented ${category}${scope} worth comparing?`,
        ["discovery", "information"],
      ],
      [
        `Which ${category}${scope} offer clear information about their products or services?`,
        ["offering", "information"],
      ],
      [
        `Where can I compare the products or services offered by ${category}${scope}?`,
        ["offering", "comparison"],
      ],
      [
        `Which ${category}${scope} explain who their products or services are suitable for?`,
        ["offering", "audience"],
      ],
      [
        `What ${category}${scope} should a budget-conscious customer consider?`,
        ["price", "audience"],
      ],
      [
        `Which ${category}${scope} publish clear pricing or explain how to request a quote?`,
        ["price", "information"],
      ],
      [
        `Which ${category}${scope} explain what is included in the price?`,
        ["price", "comparison"],
      ],
      [
        `Which ${category}${scope} make it easy to find current availability?`,
        ["availability", "information"],
      ],
      [
        `Which ${category}${scope} clearly explain how to get started?`,
        ["access", "audience"],
      ],
      [
        `Which ${category}${scope} publish clear contact information?`,
        ["contact", "information"],
      ],
      [
        `Which ${category}${scope} explain their service area or delivery coverage?`,
        ["coverage", "access"],
      ],
      [
        `Which ${category}${scope} provide useful answers to common customer questions?`,
        ["questions", "information"],
      ],
      [
        `Which ${category}${scope} explain their policies before purchase?`,
        ["policies", "information"],
      ],
      [
        `What ${category}${scope} have independently verifiable customer feedback?`,
        ["reputation", "comparison"],
      ],
      [
        `Which ${category}${scope} have useful independent coverage or reviews?`,
        ["reputation", "discovery"],
      ],
      [
        `Which ${category}${scope} clearly describe their experience or qualifications?`,
        ["trust", "information"],
      ],
      [
        `Which ${category}${scope} provide documented examples of their work or products?`,
        ["trust", "offering"],
      ],
      [
        `Which ${category}${scope} explain accessibility or customer support options?`,
        ["access", "support"],
      ],
      [
        `What ${category}${scope} should I compare before making a decision, and why?`,
        ["comparison", "discovery"],
      ],
    ];
    return templates.map(([text, intents], index) => ({
      id: `q-${String(index + 1).padStart(2, "0")}`,
      text,
      intents,
      branded: false,
    }));
  }
  const templates: [string, string[]][] = [
    [
      `Where can I get an affordable lunch near ${locality}?`,
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
      `Where can two people eat near ${locality} on a modest food budget?`,
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
