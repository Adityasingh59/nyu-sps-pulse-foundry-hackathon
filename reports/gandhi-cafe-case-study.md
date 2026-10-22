# Gandhi Cafe: Indian restaurant visibility near NYU

Observed October 21, 2026 (America/New_York). Public-information case study; no affiliation, owner confirmation, outreach or publication.

**Gandhi Cafe**, 283 Bleecker Street, Greenwich Village, New York, NY 10014. [Official website](https://gandhicafeny.com/). The site writes the street address as “283 Bleecker St #4107”; the meaning of that suffix is unverified. No exact walking time was measured.

## Why this example

The user requested an Indian restaurant close to NYU’s Washington Square campus that is outside the top five. Gandhi Cafe was absent from three initial, independent five-option lists. Screening run: `run_74f649c4-1ad1-4268-81f5-1f0653c1344d`, retained under the initially considered Mint Masala profile; the answering adapter never received that profile. Gandhi Cafe then received its own frozen 20-question baseline, rather than reusing the pizza questions or historical results.

The full baseline recommended Gandhi Cafe in **2 of 20 valid answers (10%)**, with **100% coverage**, **3.03% share of voice**, and average observed list position **2.5 across 2 appearances**. It was recommended for a casual date and a family meal. It was not recommended in the first, broad five-restaurant question.

Six distinct competitors were recommended more often: Mint Masala, Masala Times, Thelewala, The Kati Roll Company, Ananda and SEMMA. Gandhi Cafe is therefore outside the top five by recommendation frequency in this saved sample. This is not a universal ranking or an assessment of food quality.

## Recorded setup

- Restaurant ID: `restaurant_4aa7d7e9-06e1-466a-967e-3a962c59c132`.
- Bank: `bank_6ef68b4d-68b8-44ef-b789-928ef5c9999d`, 20 non-branded Indian/NYU questions, hash `b1beb27375be1eb8afdbc2e3468748efc60abf5c7295f672803006d82ff25e00`.
- Run: `run_36e28381-95b2-41a1-a007-9e4a7cec2db2`; started `2026-10-22T02:33:04.359Z`, completed `2026-10-22T02:39:07.194Z`.
- Provider/model: Codex CLI · ChatGPT sign-in / `gpt-6.1-sol`; parser `conservative-list-v4`.
- Retrieval: Codex CLI live web search; independent ephemeral conversations; no local shell, apps, plugins, or target profile in prompt. Settings hash: `fd91dde6c77e6b29bc2939594de8059d5cf117ca815b8d9cdd73f245e52376bc`.
- Actual raw answers, citations, retrieval events, original timestamps and request outcomes remain in SQLite. All 20 answers and extracted list entries were manually inspected. No answers were rewritten, removed or regenerated to obtain this result.

## Observed recommendation counts

| Saved restaurant name | Recommendations | Share of voice |
| --- | --- | --- |
| Mint Masala | 12 / 20 | 18.18% |
| Masala Times Greenwich Village | 10 / 20 | 15.15% |
| Thelewala | 9 / 20 | 13.64% |
| The Kati Roll Company | 8 / 20 | 12.12% |
| Ananda | 7 / 20 | 10.61% |
| SEMMA | 7 / 20 | 10.61% |
| Masala Times | 3 / 20 | 4.55% |
| Gandhi Cafe | 2 / 20 | 3.03% |
| Baar Baar | 1 / 20 | 1.52% |
| Bungalow | 1 / 20 | 1.52% |
| Dhamaka | 1 / 20 | 1.52% |
| GupShup | 1 / 20 | 1.52% |
| Madam Ji Ki Shaadi | 1 / 20 | 1.52% |
| Malai Marke | 1 / 20 | 1.52% |
| NY DOSAS | 1 / 20 | 1.52% |
| Taco Mahal | 1 / 20 | 1.52% |

Name-normalization limitation: the parser stores “Masala Times” and “Masala Times Greenwich Village” separately (3 and 10 appearances). All of those answers identify the same 194 Bleecker Street branch, and none lists both names together. The reviewed combined count is 13/20. This changes the order of the leaders and makes the target seventh among distinct businesses, while leaving Gandhi Cafe’s 2/20 rate and outside-top-five conclusion unchanged. The table preserves the app’s current stored extraction; no historical records were silently merged.

## Evidence and opportunities

- [Gandhi Cafe: Gandhi Cafe](https://gandhicafeny.com/) — succeeded; retrieved `2026-10-22T02:31:45.661Z`; SHA-256 `d3c0bab05ee6b776cd7661742e30634e4e6bed406b49941ffda780012377980f`.
- [Gandhi Cafe: Gandhi Cafe | Online Ordering | Locations](https://gandhicafeny.com/gandhi-cafe/locations/) — succeeded; retrieved `2026-10-22T02:31:45.849Z`; SHA-256 `af7d0d6b87f3e3bbef4f93a249a312e4cc558c835199381159059f7ae0a3582e`.
- [Mint Masala: Website inspection unavailable](https://mintmasalanyc.com/) — failed; retrieved `2026-10-22T02:39:07.347Z`; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Website returned HTTP 403; content could not be inspected.
- [Masala Times Greenwich Village: Website inspection unavailable](https://masalatimesgreenwichvillage.com/) — failed; retrieved `2026-10-22T02:39:07.472Z`; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. robots.txt returned HTTP 403; inspection stopped without bypass.
- [Thelewala: TheLeWala - Indian Restaurant NYC / Best New York City Cuisine - Top rated - Best street food in town](https://thelewalany.com/) — succeeded; retrieved `2026-10-22T02:39:07.679Z`; SHA-256 `09db9697afcf25d1702158d8034683d5645290a8c526dfa1f6b1f6f9befa6ae4`.

- **Make the public menu machine-readable.** The inspected menu page (https://gandhicafeny.com/gandhi-cafe/locations/) displays item names and prices, but no JSON-LD script was found in that page’s HTML. Sources: `source_73976f87-3f8b-420f-9063-a5bac7b946d7`, `source_8c381b3d-1053-4f55-9289-8b15273b8638`.
- **Create a clear, source-linked dining FAQ.** The 2 cited, inspected pages contain restaurant/menu information but no “FAQ” or “frequently asked questions” heading in the saved text. Questions about group dining, hours and dietary needs were tested; unanswered facts remain unknown. This is a text-inspection finding, not proof that no FAQ exists elsewhere. Sources: `source_8c381b3d-1053-4f55-9289-8b15273b8638`, `source_73976f87-3f8b-420f-9063-a5bac7b946d7`.

The top three competitors were selected from actual baseline answers before their sites were inspected. Mint Masala returned HTTP 403; the Masala Times robots check returned HTTP 403. These are unavailable evidence, not proof of absent information. Thelewala’s matching cited homepage was retrieved. Its self-published press quotations are not independently collected review/press metrics.

Only the phone link and menu URL were accepted as website-derived profile facts. Posted hours and menu examples remain in the original excerpts but are not accepted structured profile facts. Drafts therefore omit unverified cuisine, hours, prices, dietary assurances and nested menu items. The identity and branch were publicly reviewed; no owner facts were fabricated.

## Saved drafts

- [faq](gandhi-cafe-faq.md) — saved artifact `artifact_dd835ce9-559f-4818-af76-d547862d78d9`, validated and exported for review.
- [about](gandhi-cafe-about.md) — saved artifact `artifact_af606e69-27ba-4cc2-9d51-a14cbb0de0cd`, validated and exported for review.
- [jsonld](gandhi-cafe-jsonld.json) — saved artifact `artifact_f25397d5-3894-42ec-89a1-4627fdfd92a3`, validated and exported for review.

## Questions

1. What five Indian restaurants would you recommend near NYU’s Washington Square campus in Manhattan?
2. Which Indian restaurants would you recommend for dinner within about a 15-minute walk of Washington Square Park in New York City?
3. What are some Indian restaurants to consider in Greenwich Village and nearby downtown Manhattan?
4. Where can I get an Indian lunch for under $20 near NYU’s Washington Square campus?
5. Where can two people share an Indian dinner near Washington Square Park on a $50 food budget?
6. What Indian restaurants near NYU offer good value for a casual meal?
7. Where can I find a sit-down Indian dinner in Greenwich Village?
8. What Indian restaurants near Washington Square Park are suitable for a casual date?
9. Where should a small group go for Indian food near NYU in Manhattan?
10. Where can a family have an Indian meal around Greenwich Village?
11. Which Indian restaurants near Washington Square Park have vegetarian choices?
12. Where can a group with mixed dietary preferences find Indian food near NYU?
13. Which Indian restaurants near Washington Square Park publish ingredient or dietary information online?
14. Where can I find Indian curries and naan near NYU’s Washington Square campus?
15. Where can I get Indian takeout near Washington Square Park?
16. Which Indian restaurants in Greenwich Village publish a clear menu with prices online?
17. What Indian restaurants near NYU are open for dinner after 9 pm?
18. Where can I have a relaxed Indian dinner before an evening event near Washington Square Park?
19. What are Indian restaurant options within walking distance of NYU’s Bobst Library?
20. Which Indian restaurants would you suggest to someone visiting NYU’s Washington Square campus for the first time?

## Limits and preservation

One provider configuration and one baseline are measured here. List positions are presentation order, not objective quality rankings. No follow-up, controlled experiment, content publication or causal improvement is claimed. The previous 5 runs / 100 raw answers retained their exact IDs and answer hashes against the integrity checkpoint. John’s of Bleecker Street remains a separate historical case; Linden Table remains unmistakably synthetic.
