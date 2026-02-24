# Elite Marketplace Execution 2026

## Product DNA
- Positioning: Smart AI + AR commerce platform for conversion-first growth.
- Operating mode: product architecture + behavioral UX + conversion engineering + performance discipline.
- Guardrail: no visual feature without measurable impact on CTR, ATC, or checkout completion.

## Home Architecture Contract
- Hero conversion block: headline, subheadline, primary CTA, secondary CTA.
- Smart categories: top categories + trending + recommended.
- AI recommendation rail: history-aware + trend-aware + mobile horizontal.
- Campaign banners: schedulable, segment-aware, device-targeted.
- Trust block: buyer protection, secure payment, seller verification, support.
- Featured sellers: seller quality index and response badge.
- Retention block: newsletter/community CTA with tracking.

## Interaction and Motion Rules
- Hover transition: 120-180ms.
- Button press scale: `0.98`.
- Card lift: `translateY(-4px)` in hover contexts.
- Focus ring: always visible on keyboard navigation.
- No decorative motion without UX purpose.

## Performance Budgets
- Lighthouse >= 90 for landing and listing templates.
- TTFB < 200ms (edge/cache path).
- LCP < 2.5s (mobile p75).
- Image policy: next/image + responsive sizes + lazy where non-critical.

## Conversion KPI Set
- Banner CTR
- Add-to-cart rate
- Checkout drop-off rate
- Seller activation rate
- Repeat purchase rate

## Release Gate
- `pnpm ui:product:audit` must pass CI threshold.
- `pnpm ui:page-matrix` and `pnpm ui:product:backlog` artifacts must be generated.
- Visual + flow regression gates remain mandatory via `ui:playwright`.
