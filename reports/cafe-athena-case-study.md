# Café Athena — saved AI visibility results

Measured October 23, 2026. **Cafe Athena**, 1846 Garnet Ave, San Diego, CA 92109. [Official website](https://cafeathena.com/).

**Recommended in 11 of 20 valid answers (55%), with 100% completion coverage.** The average explicit list position was 1.18 across 11 appearances. Share of all parsed restaurant recommendations: 18.3%.

The target's observed frequency rank among parsed entities is 1, with ties sharing rank. This describes the saved questions and provider configuration; it is not a citywide quality ranking or a consumer ChatGPT measurement.

## Measurement

- Run: `run_6f94399a-3960-4487-a241-228e5edfedf4`; status: **completed**.
- Provider: Codex CLI · ChatGPT sign-in; model: `gpt-6.1-sol`. Each question uses an independent ephemeral conversation with recorded live web retrieval. The answering prompt does not contain the target profile.
- Frozen bank: `bank_082ff7fc-0589-4c19-a499-ac21edbad9d9`; SHA-256: `41beb573ad8ca2614f3d24286ada1272abf6975f383b29ee2eec96c8c251d2c6`. Twenty questions cover cuisine, general discovery, price, locality/distance, occasions, dietary/menu information, takeout, catering and hours. None names the target.
- Question selection: an operator-written bank based on the site's cuisine and locality. It includes both cuisine-specific and broader dining intents. This selection affects the score and is not a representative sample of all diner questions.
- Started: 2026-10-23T19:48:05.440Z; completed: 2026-10-23T19:52:58.486Z. Timestamps here are UTC.
- 0 failed answers; 0 ambiguous observations excluded. Failures reduce coverage and do not count as absence.
- Parser: `conservative-list-v4`; settings fingerprint: `fd91dde6c77e6b29bc2939594de8059d5cf117ca815b8d9cdd73f245e52376bc`. Order is presentation order, not a quality score.

## Scorecard

| Metric | Saved result |
| --- | --- |
| Mentions | 11/20 (55%) |
| Recommendations | 11/20 (55%) |
| Average explicit list position | 1.18 (11 observations) |
| Share of voice | 18.3% (11/60 recommendation appearances) |
| Coverage | 20/20 (100%) |

## Leading observed alternatives

These names come from the saved answers. Website research follows the observed recommendations; it does not determine their counts.

| Restaurant | Answers recommending it | Share of voice | Avg. explicit position |
| --- | ---: | ---: | ---: |
| Costa Brava | 4 | 6.7% | 2.50 |
| Shawarma Shack | 4 | 6.7% | 2.50 |
| Slowly Restaurant and Lounge | 3 | 5% | 2.00 |
| The Fishery | 3 | 5% | 3.33 |
| World Famous | 3 | 5% | 3.00 |

Known parser limitation in this run: Slowly / Slowly Restaurant and Lounge / Slowly Restaurant & Lounge, Spitz / Spitz – Pacific Beach, Shawarma Shack / Shawarma Shack Mediterranean Grill, and the two Ambrogio15 name variants are separate parsed entities. The table preserves these raw counts; it should not be read as a fully deduplicated business ranking. Original answers and extraction remain unchanged.

## Where the target was not recommended

- Where can I get lunch for under $20 in Pacific Beach, San Diego?
- What are relaxed weeknight dinner options in Pacific Beach, San Diego?
- Which Pacific Beach restaurants would you suggest for a casual date night?
- Where can a group with mixed dietary preferences find a restaurant in Pacific Beach with clear menu information?
- Which restaurants in Pacific Beach publish a food menu with clearly listed prices online?
- What Pacific Beach restaurants offer happy hour food or small plates?
- Where can a visitor get a sit-down lunch near Garnet Avenue in Pacific Beach?
- What are some Greek restaurants to try in San Diego?
- Which Pacific Beach restaurants are open for a sit-down dinner after 8 pm on a Friday?

Absence for a question does not prove the business cannot meet that need. The raw answers and cited links are retained for review.

## Website observations and next actions

The 4 official snapshots include the homepage, lunch/dinner menu, bar/happy-hour menu and about page. Their inspected JSON-LD contains generic WebPage/Organization and related types. Restaurant, Menu and MenuItem types were not observed in these four snapshots; this does not establish absence from uninspected pages or other markup formats. The site already has a readable food menu and posted dietary labels. Do not describe those as missing.

1. Prepare Restaurant data linked to the existing menu, using the reviewed address, cuisine, phone and visible menu. Review any item prices and currency before including offers. This is a markup-clarity proposal with no demonstrated ranking effect.
2. Add a concise dining FAQ based on the posted location, hours and menu, directing allergy, accessibility and other unverified requirements to the business. The inspected text contains no FAQ heading; that is scoped to the saved pages.
3. Use the question-level omissions above to choose content for business review. Repeat the identical frozen bank and settings after an authorized change, and retain a repeat with no change to help assess variation. No improvement has been measured.

### A concrete price-verification issue

The saved two-person budget answer cited an [official Summer 2025 PDF](https://cafeathena.com/wp-content/uploads/CafeAthena-Food-Menu-Summer2025.pdf) and quoted a gyro wrap at $12, hummos at $9 and rosemary potatoes at $6.50. The freshly collected [HTML lunch/dinner menu](https://cafeathena.com/lunch-dinner-menu/) instead displays 13, 10 and 7 for those entries. These are different published observations; no price was accepted as an owner fact or added to the drafts. Review older menu assets and point customers to the current menu. This discrepancy does not establish why the provider chose its source.

### Findings generated by the application

- **Create a clear, source-linked dining FAQ** — The 4 cited, inspected pages contain restaurant/menu information but no “FAQ” or “frequently asked questions” heading in the saved text. Questions about group dining, hours and dietary needs were tested; unanswered facts remain unknown. This is a text-inspection finding, not proof that no FAQ exists elsewhere. Action: Draft a short FAQ from accepted identity, cuisine, posted hours and current menu facts. Direct reservations, allergy, accessibility and other unverified questions to the restaurant rather than guessing. Evidence IDs: `source_1cde7253-0ebf-4a3f-a43b-157618900bb2`, `source_1ad4d211-044c-45db-8bcf-8e5d47979c42`, `source_6f845843-53a6-4aed-986e-d7959c7d5560`, `source_f1f1a811-309f-4eb6-81a8-565241cf4068`.

## Saved evidence

| Scope / entity | Page | Retrieval UTC | Status | SHA-256 |
| --- | --- | --- | --- | --- |
| Cafe Athena | [Authentic Greek and Mediterranean Food - Cafe Athena](https://cafeathena.com/) | 2026-10-23T19:47:09.498Z | succeeded | `27414da6dc05cb9f671df376138ecebd33589fd27562784acb7d8336379c5aaf` |
| Cafe Athena | [Lunch & Dinner Menu - Cafe Athena](https://cafeathena.com/lunch-dinner-menu/) | 2026-10-23T19:47:09.647Z | succeeded | `fac628d53cd33ae2b98418da026181b48059a96ae7037763b91388605546fccc` |
| Cafe Athena | [Bar & Happy Hour Menu - Cafe Athena](https://cafeathena.com/bar-happy-hour-menu/) | 2026-10-23T19:47:09.734Z | succeeded | `744834a9c1b410245d4543fa5f5b05ad8f4aa882474a9c7c0eb653d40e1a97e3` |
| Cafe Athena | [About - Cafe Athena](https://cafeathena.com/about/) | 2026-10-23T19:47:09.909Z | succeeded | `e91a7cf36d68a61eb01b16d0aaa80bd77bfef2f12a355c23e214fc517c98dfd6` |
| Costa Brava | [Costa Brava - Spanish Restaurant and Tapas Bar - San Diego](https://costabravasd.com/) | 2026-10-23T19:53:00.296Z | succeeded | `75f47d3c68fe70da57533ff4b0c7f03bf6d1cc0adeba66ad519661421e2bad4e` |
| Costa Brava | [Menus - Costa Brava - Spanish Restaurant and Tapas Bar](https://costabravasd.com/dish_menu/menus/) | 2026-10-23T19:53:01.132Z | succeeded | `018f553ab1fe639b27bb8e2a6e3455e16dab5477b5e01845bca64907090b43f5` |
| Costa Brava | [Hot Tapas - Costa Brava - Spanish Restaurant and Tapas Bar](https://costabravasd.com/dish_menu/hot_tapas/) | 2026-10-23T19:53:02.485Z | succeeded | `f4d1e192af848965d4bcafa5f1897302251279559626f0cde4affddc788e7d3b` |
| Costa Brava | [Cold Tapas - Costa Brava - Spanish Restaurant and Tapas Bar](https://costabravasd.com/dish_menu/cold_tapas/) | 2026-10-23T19:53:03.803Z | succeeded | `0b7b06bc2896517dc314002d94f3fd75874dd57414f8cc0aadf9f4fd8df9471e` |
| Costa Brava | [Entrees - Costa Brava - Spanish Restaurant and Tapas Bar](https://costabravasd.com/dish_menu/entrees/) | 2026-10-23T19:53:04.979Z | succeeded | `a2cbb5ab6480373f5815587a2502de6cf270eacfb91c655aa24ac611de265073` |
| Shawarma Shack | [Website inspection unavailable](https://shawarmashacksd.com/) | 2026-10-23T19:53:05.109Z | failed | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

Evidence limitations:

- The cited public website for Shawarma Shack could not be inspected; unavailable evidence is not an information gap.
- No confidently matching provider-cited website was available for Slowly Restaurant and Lounge; its website evidence was not guessed.

## Every tested question

| # | Frozen question | Target outcome | Explicit position |
| ---: | --- | --- | ---: |
| 1 | What Greek restaurants would you recommend in Pacific Beach, San Diego? | Recommended | 1 |
| 2 | Where can I get Mediterranean food for lunch in Pacific Beach, San Diego? | Recommended | 1 |
| 3 | Where can I have a sit-down Greek dinner near Garnet Avenue in Pacific Beach? | Recommended | 1 |
| 4 | Which Mediterranean restaurants in Pacific Beach are good options for sharing small plates with friends? | Recommended | 1 |
| 5 | Where can I get lunch for under $20 in Pacific Beach, San Diego? | Not mentioned | — |
| 6 | Where can two people get Mediterranean food in Pacific Beach on a $50 food budget? | Recommended | 3 |
| 7 | What are relaxed weeknight dinner options in Pacific Beach, San Diego? | Not mentioned | — |
| 8 | Which Pacific Beach restaurants would you suggest for a casual date night? | Not mentioned | — |
| 9 | Where can a family get Greek or Mediterranean food in Pacific Beach, San Diego? | Recommended | 1 |
| 10 | Which Mediterranean restaurants in Pacific Beach publish vegetarian options on their menus? | Recommended | 1 |
| 11 | Where can a group with mixed dietary preferences find a restaurant in Pacific Beach with clear menu information? | Not mentioned | — |
| 12 | Which restaurants in Pacific Beach publish a food menu with clearly listed prices online? | Not mentioned | — |
| 13 | Where can I order Greek food for takeout in Pacific Beach, San Diego? | Recommended | 1 |
| 14 | What Pacific Beach restaurants offer happy hour food or small plates? | Not mentioned | — |
| 15 | Where can a visitor get a sit-down lunch near Garnet Avenue in Pacific Beach? | Not mentioned | — |
| 16 | Which Pacific Beach restaurants serve Mediterranean food and cocktails? | Recommended | 1 |
| 17 | What are some Greek restaurants to try in San Diego? | Not mentioned | — |
| 18 | Where can I find a Mediterranean lunch near Mission Bay in San Diego? | Recommended | 1 |
| 19 | Which Greek or Mediterranean restaurants offer catering in Pacific Beach, San Diego? | Recommended | 1 |
| 20 | Which Pacific Beach restaurants are open for a sit-down dinner after 8 pm on a Friday? | Not mentioned | — |

## Reviewable drafts and exports

- FAQ: [saved text](cafe-athena-faq-draft.md), app artifact `artifact_4c287ad6-58d1-40ec-bc0e-4f942c07a03e` (version 2, validation passed).
- About copy: [saved text](cafe-athena-about-draft.md), app artifact `artifact_9286b5eb-6ed3-4886-a779-02768f6af888` (version 2, validation passed).
- [Download the application evidence report](http://127.0.0.1:3001/api/runs/run_6f94399a-3960-4487-a241-228e5edfedf4/report) while the local server is running. Raw answers, citations, source snapshots and opportunities are retained in SQLite. An expanded local export including drafts is at `data/cafe-athena-report.json`.

## Limits

One provider, one sample per question, and one run. Parser extraction is conservative and may split name variants or miss recommendations outside a recognizable list. Public website statements and provider claims are not owner confirmation. No independent review counts/ratings were collected. No before/after improvement, publication, outreach, or effect on public AI systems is claimed. Drafts require business review; no restaurant website was changed.
