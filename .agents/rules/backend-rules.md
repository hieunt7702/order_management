# Shopee Backend Architecture & Data Integrity Rules

1. **Multi-Tenant Isolation**:
   - Every database query for tenant-scoped resources must filter by `tenantId`.
   - Never trust `tenantId` from request parameters or bodies. Always verify through the authenticated `UserContext` and active `Membership`.
   - Idempotency keys and cache keys must always be scoped by `tenantId`.

2. **Inventory Ledger Invariants**:
   - `available = onHand - reserved`. Negative stock is strictly disallowed.
   - Every stock change must be recorded in an immutable ledger with audit context (`movementType`, `performedBy`, `referenceId`).
   - Balances and ledgers must be modified within the same atomic database transaction.
   - Multiple SKU row locks must always be ordered deterministically to prevent deadlocks.

3. **Scanning & Verification Invariants**:
   - Quoting codes must be normalized and unambiguous. If multiple packages/orders match, return `AMBIGUOUS_CODE`.
   - Scans confirm internal physical handover/dispatch, not carrier delivery.
   - Dual-layer deduplication: check idempotency key + package state (`PACKED`/`RESERVED` -> `DISPATCHED`).
   - Never dispatch orders that are unmapped, out-of-stock, or cancelled.

4. **Monetary & Settlement Invariants**:
   - Use `Decimal` (PostgreSQL `NUMERIC(15,2)`), never floating-point numbers.
   - Do not conflate Gross Merchandise Value (GMV) with actual settled revenue.
   - Snapshot COGS and prices at order creation time.
