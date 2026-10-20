# John’s of Bleecker Street — real case study

This case study uses the [restaurant’s official website](https://johnsofbleecker.com/) and [public food menu](https://johnsofbleecker.com/food-menu). The reviewed street address is 278 Bleecker Street, New York, NY 10014. Facts retain website provenance; the project does not represent the business or publish on its site.

## What was measured

Two independent live runs repeated the same frozen 20-question bank. Questions covered pizza/cuisine, price, dining occasion, location/distance, hours and preferences; they did not name the target. Each answer ran in a separate Codex CLI conversation with live web search. The saved provider was **Codex CLI · ChatGPT sign-in**, model **gpt-6.1-sol**. This describes that configuration, not the consumer ChatGPT application or a universal restaurant rank.

| Metric | Baseline | Follow-up |
| --- | ---: | ---: |
| Valid answers / attempted | 20/20 | 20/20 |
| Mention rate | 75% | 75% |
| Recommendation rate | 75% | 75% |
| Average explicit list position | 1.47 (15 samples) | 1.53 (15 samples) |
| Recommendation share of voice | 24.59% | 23.81% |
| Completion coverage | 100% | 100% |

**Comparison:** 20 matched valid question/sample pairs, 0 excluded. Mention-rate change: 0 percentage points. Recommendation-rate change: 0 percentage points. Both runs used compatible saved settings and the same reviewed parser. No restaurant content was published between runs, and this comparison does not establish causation.

- Baseline recorded at 2026-10-20T11:41:03.568Z; ID: `run_426d5165-73f6-4270-af81-b2715c609fde`.
- Follow-up recorded at 2026-10-20T11:49:26.225Z; ID: `run_3d567f41-3bb7-4136-a70d-dd29c970d0bf`.
- Baseline leading observed competitors: Bleecker Street Pizza (6 recommendations); Song E' Napule (5 recommendations); Denino’s Greenwich Village (4 recommendations).
- Follow-up leading observed competitors: Bleecker Street Pizza (8 recommendations); Arturo’s Coal Oven Pizza (5 recommendations); Song ’e Napule (5 recommendations).

The app includes an Others category when displaying selected recommendation shares; all observed restaurants remain in the denominator.

## Evidence-backed work

1. **Make the public menu machine-readable.** The inspected menu page (https://johnsofbleecker.com/food-menu) displays item names and prices, but no JSON-LD script was found in that page’s HTML. The homepage already includes Restaurant structured data; this finding is specifically about the menu page.

   Action: Prepare Restaurant data linked to a Menu with only accepted, source-verified item names and prices. Check that the visible menu and embedded data match before any authorized publication.

   Observed competitor example: Denino’s Greenwich Village appears in the observed recommendations, and its cited snapshot contains Menu/MenuItem structured data.

2. **Clarify pizza size and price differences.** In the inspected menu, “The Sasso” lists a 14-inch pizza at $26.00 and a 16-inch pizza at $26.00, while the 14-inch description says “Only $3 more” for a 16-inch. 9 size/price pairs have this wording mismatch. This needs business review; the application does not choose a corrected price.

   Action: Ask the business to reconcile the size/price wording. In the meantime, prepare a customer FAQ using only unambiguous, accepted base-size prices and link directly to the current menu.

3. **Create a clear, source-linked dining FAQ.** The 4 cited, inspected pages contain restaurant/menu information but no “FAQ” or “frequently asked questions” heading in the saved text. Questions about group dining, hours and dietary needs were tested; unanswered facts remain unknown. This is a text-inspection finding, not proof that no FAQ exists elsewhere.

   Action: Draft a short FAQ from accepted identity, cuisine, posted hours and current menu facts. Direct reservations, allergy, accessibility and other unverified questions to the restaurant rather than guessing.

These are information-quality hypotheses. No numerical visibility uplift is forecast. Sources that failed retrieval, belonged to a different restaurant, or covered unrelated branches remain in the history with explicit exclusions/review notes. They do not support the findings.

## Exported drafts

- [FAQ draft](johns-bleecker-faq.md), using accepted identity, cuisine, posted hours and unambiguous base-size prices.
- [Restaurant and nested Menu JSON-LD](johns-bleecker-jsonld.json), with validated MenuItem/Offer field types.
- [Saved comparison](johns-bleecker-comparison.json).

All drafts require review before any separately authorized publication. Existing Restaurant schema was observed on the homepage; the menu finding specifically concerns the inspected food-menu page. No awards, reviews, dietary assurances, corrected prices or successful publication were invented.

## Verification

All 42 isolated automated tests and the production build passed. Two completed live runs saved 40 raw answers. A managed application restart preserved all 40 answer hashes, and the built interface is served at <http://127.0.0.1:3001>. Browser automation was unavailable during this phase; visual QA of the latest interface changes remains unverified. The prior synthetic milestone had separate browser/mobile checks.
