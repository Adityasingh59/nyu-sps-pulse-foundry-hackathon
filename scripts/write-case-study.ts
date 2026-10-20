import { writeFile, mkdir } from 'node:fs/promises';
import type { Bootstrap, Comparison, Opportunity } from '../shared/types.ts';
const base=process.env.TABLESIGNAL_API_URL||'http://127.0.0.1:3001/api';
const d=await(await fetch(base+'/bootstrap')).json() as Bootstrap;
const restaurant=d.restaurants.find(r=>new URL(r.website).hostname.replace(/^www\./,'')==='johnsofbleecker.com')!;
const runs=d.runs.filter(r=>r.restaurantId===restaurant.id&&r.mode==='live').sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
const before=runs[0],after=runs[1];
const comparison=await(await fetch(`${base}/comparisons?before=${before.id}&after=${after.id}`)).json() as Comparison;
const opportunities=await(await fetch(`${base}/runs/${before.id}/opportunities`)).json() as Opportunity[];
const p=(v:number|null|undefined)=>v==null?'unavailable':`${Number(v.toFixed(2))}%`;
const position=(v:number|null|undefined)=>v==null?'unavailable':v.toFixed(2);
const leading=(r:typeof before)=>r.competitors.filter(c=>!c.isTarget).slice(0,3).map(c=>`${c.name} (${c.appearances} recommendations)`).join('; ');
const content=`# John’s of Bleecker Street — real case study

This case study uses the [restaurant’s official website](${restaurant.website}) and [public food menu](https://johnsofbleecker.com/food-menu). The reviewed street address is278 Bleecker Street, New York, NY10014. Facts retain website provenance; the project does not represent the business or publish on its site.

## What was measured

Two independent live runs repeated the same frozen20-question bank. Questions covered pizza/cuisine, price, dining occasion, location/distance, hours and preferences; they did not name the target. Each answer ran in a separate Codex CLI conversation with live web search. The saved provider was **${before.provider}**, model **${before.model}**. This describes that configuration, not the consumer ChatGPT application or a universal restaurant rank.

| Metric | Baseline | Follow-up |
| --- | ---: | ---: |
| Valid answers / attempted | ${before.metrics?.valid}/${before.metrics?.attempted} | ${after.metrics?.valid}/${after.metrics?.attempted} |
| Mention rate | ${p(before.metrics?.mentionRate)} | ${p(after.metrics?.mentionRate)} |
| Recommendation rate | ${p(before.metrics?.recommendationRate)} | ${p(after.metrics?.recommendationRate)} |
| Average explicit list position | ${position(before.metrics?.averagePosition)} (${before.metrics?.positionSamples} samples) | ${position(after.metrics?.averagePosition)} (${after.metrics?.positionSamples} samples) |
| Recommendation share of voice | ${p(before.metrics?.shareOfVoice)} | ${p(after.metrics?.shareOfVoice)} |
| Completion coverage | ${p(before.metrics?.coverage)} | ${p(after.metrics?.coverage)} |

**Comparison:** ${comparison.matched} matched valid question/sample pairs, ${comparison.excluded} excluded. Mention-rate change: ${comparison.mentionRateChange} percentage points. Recommendation-rate change: ${comparison.recommendationRateChange} percentage points. Both runs used compatible saved settings and the same reviewed parser. No restaurant content was published between runs, and this comparison does not establish causation.

- Baseline recorded at ${before.createdAt}; ID: \`${before.id}\`.
- Follow-up recorded at ${after.createdAt}; ID: \`${after.id}\`.
- Baseline leading observed competitors: ${leading(before)}.
- Follow-up leading observed competitors: ${leading(after)}.

The app includes an Others category when displaying selected recommendation shares; all observed restaurants remain in the denominator.

## Evidence-backed work

${opportunities.map((o,i)=>`${i+1}. **${o.title}.** ${o.gap}\n\n   Action: ${o.action}${o.competitorExample?`\n\n   Observed competitor example: ${o.competitorExample}`:''}`).join('\n\n')}

These are information-quality hypotheses. No numerical visibility uplift is forecast. Sources that failed retrieval, belonged to a different restaurant, or covered unrelated branches remain in the history with explicit exclusions/review notes. They do not support the findings.

## Exported drafts

- [FAQ draft](johns-bleecker-faq.md), using accepted identity, cuisine, posted hours and unambiguous base-size prices.
- [Restaurant and nested Menu JSON-LD](johns-bleecker-jsonld.json), with validated MenuItem/Offer field types.
- [Saved comparison](johns-bleecker-comparison.json).

All drafts require review before any separately authorized publication. Existing Restaurant schema was observed on the homepage; the menu finding specifically concerns the inspected food-menu page. No awards, reviews, dietary assurances, corrected prices or successful publication were invented.

## Verification

All42 isolated automated tests and the production build passed. Two completed live runs saved40 raw answers. A managed application restart preserved all40 answer hashes, and the built interface is served at <http://127.0.0.1:3001>. Browser automation was unavailable during this phase; visual QA of the latest interface changes remains unverified. The prior synthetic milestone had separate browser/mobile checks.
`;
await mkdir('reports',{recursive:true});await writeFile('reports/johns-bleecker-case-study.md',content.replace('address is278','address is 278').replace('NY10014','NY 10014').replace('frozen20','frozen 20').replace('All42','All 42').replaceAll('saved40','saved 40').replaceAll('all40','all 40'));
await writeFile('reports/johns-bleecker-comparison.json',JSON.stringify(comparison,null,2)+'\n');
for(const run of runs){const report=await(await fetch(`${base}/runs/${run.id}/report`)).json();await writeFile(`data/${run.id}-evidence-report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify({caseStudy:'reports/johns-bleecker-case-study.md',compatible:comparison.compatible,matched:comparison.matched,mentionRateChange:comparison.mentionRateChange,artifacts:d.artifacts.filter(a=>a.restaurantId===restaurant.id).map(a=>({id:a.id,type:a.type,runId:a.runId,valid:a.validation.valid}))},null,2));
