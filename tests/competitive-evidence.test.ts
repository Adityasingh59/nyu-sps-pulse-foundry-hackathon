import test from "node:test";
import assert from "node:assert/strict";
import { citedCompetitorWebsite } from "../server/competitive-evidence.ts";
import type { Run, Competitor } from "../shared/types.ts";
const competitor: Competitor = {
  entityId: "restaurant:song-e-napule",
  name: "Song E' Napule",
  appearances: 2,
  shareOfVoice: 20,
  averagePosition: 2,
  isTarget: false,
};
const run = {
  results: [
    {
      citations: [
        {
          url: "https://www.theinfatuation.com/new-york/reviews/song-napule",
          title: "Song E' Napule",
        },
        { url: "https://www.songenapule.us/", title: "Official locations" },
      ],
    },
  ],
} as Run;
test("competitor collection selects actually cited matching restaurant domains and avoids third-party review pages", () => {
  assert.equal(
    citedCompetitorWebsite(run, competitor),
    "https://www.songenapule.us/",
  );
  assert.equal(
    citedCompetitorWebsite(
      {
        ...run,
        results: [
          {
            citations: [
              {
                url: "https://www.theinfatuation.com/new-york/reviews/song-napule",
                title: "Song E' Napule",
              },
            ],
          },
        ],
      } as Run,
      competitor,
    ),
    undefined,
  );
});
test("competitor sources are never guessed from unobserved domains or private citation URLs", () => {
  const other = {
    ...run,
    results: [
      {
        citations: [
          { url: "http://127.0.0.1/menu", title: "Song E' Napule" },
          { url: "https://unrelated.example/", title: "Song E' Napule" },
        ],
      },
    ],
  } as Run;
  assert.equal(citedCompetitorWebsite(other, competitor), undefined);
});

test("restaurants sharing a neighborhood word do not share an official website identity", () => {
  const bleecker = { ...competitor, name: "Bleecker Street Pizza" };
  const citations = {
    ...run,
    results: [
      {
        citations: [
          { url: "https://johnsofbleecker.com/", title: "John's of Bleecker" },
          {
            url: "https://bleeckerstreetpizza.com/",
            title: "Bleecker Street Pizza",
          },
        ],
      },
    ],
  } as Run;
  assert.equal(
    citedCompetitorWebsite(citations, bleecker),
    "https://bleeckerstreetpizza.com/",
  );
  const onlyWrong = {
    ...run,
    results: [
      {
        citations: [
          {
            url: "https://johnsofbleecker.com/",
            title: "Bleecker Street Pizza",
          },
        ],
      },
    ],
  } as Run;
  assert.equal(citedCompetitorWebsite(onlyWrong, bleecker), undefined);
});

test("an unrelated branch menu is excluded from the Greenwich Village evidence collection", async () => {
  const { relevantBranchPage } = await import(
    "../server/competitive-evidence.ts"
  );
  assert.equal(
    relevantBranchPage(
      "https://www.songenapule.us/west-village-menu",
      "Greenwich Village, New York City",
    ),
    true,
  );
  assert.equal(
    relevantBranchPage(
      "https://www.songenapule.us/rutherford-menu",
      "Greenwich Village, New York City",
    ),
    false,
  );
  assert.equal(
    relevantBranchPage(
      "https://www.songenapule.us/upper-west-side-menu",
      "Greenwich Village, New York City",
    ),
    false,
  );
});
