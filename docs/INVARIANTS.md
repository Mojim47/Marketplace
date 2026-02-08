# System Invariants

Falsifiable, observable invariants for Auth, Payment, and Error systems.

---

## AUTH INVARIANTS

### AUTH-1: Token Signature Validity
**Invariant:** Every accepted JWT has a valid cryptographic signature from the configured secret.
**Violation Signal:** Log `auth.token.signature_invalid` with `{token_hash, timestamp}`
**Blast Radius:** Single request rejected (401)
**Enforcement:** `JwtStrategy.validate()` - Passport-JWT verifies signature before payload extraction

### AUTH-2: Token Expiration Enforcement
**Invariant:** No token with `exp < now()` is accepted. `ignoreExpiration: false` is immutable.
**Violation Signal:** Log `auth.token.expired` with `{token_hash, exp, now, delta_seconds}`
**Blast Radius:** Single request rejected (401)
**Enforcement:** `JwtStrategy` constructor sets `ignoreExpiration: false`

### AUTH-3: Token Payload Completeness
**Invariant:** Every accepted token contains non-null `sub` (user ID) and `email` fields.
**Violation Signal:** Log `auth.token.payload_incomplete` with `{token_hash, missing_fields}`
**Blast Radius:** Single request rejected (401)
**Enforcement:** `JwtStrategy.validate()` throws `UnauthorizedException` if `!payload.sub || !payload.email`

### AUTH-4: Refresh Token Isolation
**Invariant:** Refresh tokens use a separate secret (`JWT_REFRESH_SECRET`) from access tokens.
**Violation Signal:** Metric `auth.refresh.secret_collision = 1` if secrets match at startup
**Blast Radius:** System startup failure
**Enforcement:** Config validation at `AuthService` construction

### AUTH-5: Authentication Failure Logging
**Invariant:** Every authentication failure is logged with IP, user-agent, and failure reason.
**Violation Signal:** Missing `auth.failure` log entry for any 401 response
**Blast Radius:** Audit gap (no immediate user impact)
**Enforcement:** `JwtAuthGuard.handleRequest()` logs on `err || !user`

---

## PAYMENT INVARIANTS

### PAY-1: Idempotency Key Uniqueness
**Invariant:** For any `idempotency_key`, at most one payment record exists. Duplicate requests return the existing record.
**Violation Signal:** Log `payment.idempotency.duplicate_created` with `{idempotency_key, payment_ids[]}`
**Blast Radius:** Double charge (critical)
**Enforcement:** `PaymentService.createPayment()` checks `findByIdempotencyKey()` before INSERT

### PAY-2: Payment State Machine
**Invariant:** Payment status transitions follow: `PENDING → PROCESSING → {COMPLETED|FAILED}` or `PENDING → CANCELLED`. No other transitions.
**Violation Signal:** Log `payment.state.invalid_transition` with `{payment_id, from, to}`
**Blast Radius:** Data corruption, reconciliation failure
**Enforcement:** SQL UPDATE with WHERE clause on current status

### PAY-3: Amount Immutability
**Invariant:** `payments.amount` never changes after INSERT.
**Violation Signal:** Audit log diff showing `amount` change
**Blast Radius:** Financial discrepancy
**Enforcement:** No UPDATE statement modifies `amount` column

### PAY-4: Gateway Response Persistence
**Invariant:** Every gateway interaction (success or failure) is persisted in `gateway_response` JSONB.
**Violation Signal:** `payment.gateway.response_missing` for any COMPLETED/FAILED payment with null `gateway_response`
**Blast Radius:** Dispute resolution failure
**Enforcement:** `verifyPayment()` always sets `gateway_response` before status update

### PAY-5: Audit Trail Completeness
**Invariant:** Every payment state change produces an `audit_logs` entry with action `PAYMENT_{ACTION}`.
**Violation Signal:** Count mismatch: `payments` state changes vs `audit_logs` entries
**Blast Radius:** Compliance failure
**Enforcement:** `logAudit()` called in every state-changing method

### PAY-6: Double-Entry Balance
**Invariant:** For every financial transaction, `SUM(debits) = SUM(credits)`.
**Violation Signal:** `transaction.balance.mismatch` with `{transaction_id, debit_sum, credit_sum}`
**Blast Radius:** Accounting inconsistency
**Enforcement:** `TransactionManager.verifyTransactionBalance()` validates before execution

### PAY-7: Non-Negative Account Balance
**Invariant:** No account balance goes negative after any transaction.
**Violation Signal:** `account.balance.negative` with `{account_id, balance, transaction_id}`
**Blast Radius:** Overdraft, financial loss
**Enforcement:** `TransactionManager.executeTransaction()` validates with `SELECT FOR UPDATE` before debit

### PAY-8: Transaction Atomicity
**Invariant:** If any entry in a transaction fails, all entries are rolled back. Balances remain unchanged.
**Violation Signal:** `transaction.atomicity.partial` with `{transaction_id, applied_entries, failed_entry}`
**Blast Radius:** Partial state, reconciliation nightmare
**Enforcement:** PostgreSQL `SERIALIZABLE` isolation in `$transaction()` block

### PAY-9: Minimum Amount Enforcement
**Invariant:** ZarinPal payments below 1000 Rials are rejected before gateway call.
**Violation Signal:** `payment.zarinpal.below_minimum` with `{amount, minimum}`
**Blast Radius:** Gateway error, poor UX
**Enforcement:** `ZarinpalService.requestPayment()` throws `BusinessRuleError.minimumAmountNotMet()`

### PAY-10: Refund Precondition
**Invariant:** Only COMPLETED payments can be refunded.
**Violation Signal:** `payment.refund.invalid_status` with `{payment_id, current_status}`
**Blast Radius:** Invalid refund attempt
**Enforcement:** `PaymentService.refundPayment()` checks `status === 'COMPLETED'`

---

## ERROR INVARIANTS

### ERR-1: Error-to-Status Bijection
**Invariant:** Each `AppError` subclass maps to exactly one HTTP status code. Same error type always produces same status.
**Violation Signal:** Log `error.status.mismatch` if response status differs from `error.statusCode`
**Blast Radius:** Client confusion, incorrect error handling
**Enforcement:** `AppError.statusCode` is `readonly` and set in constructor

### ERR-2: Error Code Presence
**Invariant:** Every error response contains a non-null `code` from `ErrorCode` enum.
**Violation Signal:** Response with `code: null` or `code: undefined`
**Blast Radius:** Client cannot programmatically handle errors
**Enforcement:** `AppError.toResponse()` always includes `code`

### ERR-3: No Stack Trace Leakage
**Invariant:** No error response contains stack traces or internal paths.
**Violation Signal:** Response body containing `at `, `node_modules`, or file paths
**Blast Radius:** Security vulnerability (information disclosure)
**Enforcement:** `GlobalExceptionFilter` never includes `exception.stack` in response

### ERR-4: Raw Error Interception
**Invariant:** Raw `Error` objects and string throws are converted to `InternalError` (500).
**Violation Signal:** Response with non-standard error structure
**Blast Radius:** Inconsistent API contract
**Enforcement:** `GlobalExceptionFilter.buildErrorResponse()` catches `Error` and `string` types

### ERR-5: Error Logging Completeness
**Invariant:** Every error response is logged with `{code, statusCode, path, method, requestId}`.
**Violation Signal:** Missing log entry for any error response
**Blast Radius:** Debugging blind spot
**Enforcement:** `GlobalExceptionFilter.logError()` called for every exception

### ERR-6: 5xx Stack Trace Logging
**Invariant:** All 500+ errors log full stack trace (server-side only).
**Violation Signal:** 500 error without stack trace in logs
**Blast Radius:** Cannot debug production issues
**Enforcement:** `GlobalExceptionFilter.logError()` includes stack for `statusCode >= 500`

### ERR-7: Persian Message Availability
**Invariant:** Every user-facing error has `messageFA` for Persian localization.
**Violation Signal:** `AppError` instance with `messageFA === undefined`
**Blast Radius:** Poor UX for Persian users
**Enforcement:** All `AppError` factory methods provide `messageFA`

### ERR-8: Timestamp Presence
**Invariant:** Every error response contains ISO 8601 `timestamp`.
**Violation Signal:** Response with missing or malformed `timestamp`
**Blast Radius:** Cannot correlate errors with logs
**Enforcement:** `AppError.toResponse()` always sets `timestamp: new Date().toISOString()`

---

## ENFORCEMENT MECHANISMS

| Invariant | Enforcement Type | Verification Method |
|-----------|------------------|---------------------|
| AUTH-1 | Runtime (Passport-JWT) | Unit test: invalid signature → 401 |
| AUTH-2 | Runtime (Passport-JWT) | Unit test: expired token → 401 |
| AUTH-3 | Runtime (Guard) | Unit test: incomplete payload → 401 |
| AUTH-4 | Startup validation | Integration test: distinct secrets |
| AUTH-5 | Runtime (Guard) | Log assertion in E2E tests |
| PAY-1 | Database (unique constraint) | Property test: duplicate key → same record |
| PAY-2 | Application logic | State machine test |
| PAY-3 | Code review + audit | No UPDATE on amount column |
| PAY-4 | Application logic | Integration test: gateway_response not null |
| PAY-5 | Application logic | Count comparison query |
| PAY-6 | Application logic | Property test: debit_sum = credit_sum |
| PAY-7 | Database (CHECK constraint) + App | Property test: no negative balance |
| PAY-8 | PostgreSQL SERIALIZABLE | Integration test: partial failure → rollback |
| PAY-9 | Application logic | Unit test: amount < 1000 → BusinessRuleError |
| PAY-10 | Application logic | Unit test: non-COMPLETED → rejection |
| ERR-1 | Type system (readonly) | Compile-time + unit test |
| ERR-2 | Type system | Unit test: code always present |
| ERR-3 | Application logic | E2E test: no stack in response |
| ERR-4 | Application logic | Unit test: raw Error → 500 |
| ERR-5 | Application logic | Log assertion |
| ERR-6 | Application logic | Log assertion for 5xx |
| ERR-7 | Code review | Unit test: messageFA defined |
| ERR-8 | Application logic | Unit test: timestamp format |

---

## REJECTION REASONS

None. All invariants are enforceable via:
1. Runtime checks with observable logs/metrics
2. Database constraints
3. Type system guarantees
4. Automated tests

---

## MONITORING QUERIES

```sql
-- PAY-1: Idempotency violations
SELECT idempotency_key, COUNT(*) 
FROM payments 
WHERE idempotency_key IS NOT NULL 
GROUP BY idempotency_key 
HAVING COUNT(*) > 1;

-- PAY-5: Audit trail gaps
SELECT p.id, p.status, p.updated_at
FROM payments p
LEFT JOIN audit_logs a ON a.resource_id = p.id::text AND a.resource = 'payment'
WHERE a.id IS NULL;

-- PAY-6: Double-entry violations
SELECT t.id, 
       SUM(CASE WHEN e.type = 'DEBIT' THEN e.amount ELSE 0 END) as debits,
       SUM(CASE WHEN e.type = 'CREDIT' THEN e.amount ELSE 0 END) as credits
FROM financial_transactions t
JOIN transaction_entries e ON e.transaction_id = t.id
GROUP BY t.id
HAVING ABS(SUM(CASE WHEN e.type = 'DEBIT' THEN e.amount ELSE 0 END) - 
           SUM(CASE WHEN e.type = 'CREDIT' THEN e.amount ELSE 0 END)) > 0.01;

-- PAY-7: Negative balance detection
SELECT id, balance FROM accounts WHERE balance < 0;
```

## PROMETHEUS METRICS

```
# AUTH
auth_token_validation_total{result="success|invalid_signature|expired|incomplete_payload"}
auth_refresh_total{result="success|invalid"}

# PAYMENT
payment_created_total{method="ZARINPAL|BANK_TRANSFER|CREDIT"}
payment_verified_total{result="success|failed"}
payment_idempotency_hit_total
transaction_balance_check_total{result="pass|fail"}
account_balance_negative_total

# ERROR
http_errors_total{code="VALIDATION_FAILED|UNAUTHORIZED|...", status="400|401|..."}
error_stack_logged_total{severity="warn|error"}
```
