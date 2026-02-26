# Production Hardening Program (Elite 2026)

## Non-Negotiable Contract
- Execute only in deterministic states.
- Enforce every invariant as a hard contract.
- Audit every side-effect.
- Treat untracked rollback or silent success as catastrophic failure.
- No feature may be merged if it introduces a transition not defined in `ops/runbooks/state-machine-auth-cart-checkout.md`.

## Phase 0: System Freeze (Mandatory)
- Feature freeze: no net-new feature code while stabilization is active.
- Dependency freeze: no `package.json`/`pnpm-lock.yaml` changes.
- Schema freeze: no `prisma/schema.prisma` or `prisma/migrations/*` changes.
- Lockfile freeze: lockfile immutability required.
- Enforcement script: `ops/scripts/enforce-system-freeze.sh`.

## Phase 1: Canonical Contract Authority
- Authoritative source: **Prisma schema is canonical**.
- Domain code must conform to Prisma types.
- Any domain field not in schema is invalid and must be removed or added via migration first.

## Phase 2: Build Graph Surgery (Launch Scope)
- Launch graph includes only:
  - `auth` (token verification contract)
  - `cart`
  - `checkout`
  - `orders`
  - `health`
- Modules outside launch scope are removed from the launch boot graph.
- No commented imports, no dynamic bypass imports.

## Phase 3: Deterministic CI Gates
- `pnpm install --frozen-lockfile`
- `prisma validate`
- `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code`
- `tsc/typecheck` launch scope
- build launch scope
- health probes:
  - `GET /health/live`
  - `GET /health/ready`
  - `GET /health/startup`
- contract E2E:
  - `apps/api/test/checkout-contract.spec.ts`

## Phase 4: Health Contract
- `/health/live`: process alive only.
- `/health/ready`: database + redis + schema + queue.
- `/health/startup`: cold boot contract (db/redis/schema/queue all green).
- `READY` is a continuous runtime invariant, not a one-time boot snapshot.
- If dependencies regress post-boot, readiness must move to `503` deterministically.
- Readiness must fail when:
  - migration incomplete/pending
  - schema mismatch
  - redis unavailable
  - queue lag above threshold

## Phase 5: Artifact Discipline
- Deploy only by immutable digest.
- Release order:
  1. `git tag vX.Y.Z`
  2. CI build
  3. image + digest
  4. signature
  5. registry publish
  6. deploy by digest

## Phase 6: State Machine Enforcement
- Transition table is immutable.
- Illegal transition emits metric/log and hard-fails request.
- Guard failures must include:
  - `prevState`
  - `nextState`
  - `guardReason`
  - `traceId`
- Order creation hard contract:
  - `order.id` exists
  - `order.orderNumber` exists
  - audit fields present

## Failure Modeling
- Runtime failure matrix is canonical in `ops/runbooks/runtime-failure-matrix.md`.
