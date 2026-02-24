# AIMarket Information Architecture 2026

## Scope
- Search-first header with dominant query input
- Multi-level mega category navigation (L1/L2/L3)
- Featured and promoted categories for campaigns

## Contracts
- Category taxonomy contract: `ops/contracts/aimarket-category-taxonomy.v1.json`

## Runtime UI
- Desktop mega menu with grouped category cards
- Mobile compact navigation with search-first pattern
- Trending keyword chips for zero-query discovery

## Enforcement
- Taxonomy changes must preserve `id`, `slug`, and parent linkage
- Any new L3 node must include explicit `parent_id` and `sort_order`
- Featured categories should map to active campaign priorities

