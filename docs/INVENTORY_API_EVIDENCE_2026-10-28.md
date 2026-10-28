# Inventory API evidence — 28 October 2026

The owner approved building a compact FastAPI/PostgreSQL inventory project with migrations, reservations that cannot oversell through the API, integration tests, Docker Compose and CI.

## Published implementation

- [Repository and local run guide](https://github.com/arthur-fay/inventory-reservations-api#run-locally).
- [Reviewed implementation PR #1](https://github.com/arthur-fay/inventory-reservations-api/pull/1), merged as `bf7289f330f16b796773f302bcb475da4b48cb88`.
- Final tested implementation head: `9c4eee37a79905cf734ae81308e9251b98d371fe`.
- [Transaction service](https://github.com/arthur-fay/inventory-reservations-api/blob/main/src/inventory_api/service.py), [schema migration](https://github.com/arthur-fay/inventory-reservations-api/blob/main/migrations/versions/0001_inventory.py), [concurrency tests](https://github.com/arthur-fay/inventory-reservations-api/blob/main/tests/integration/test_concurrency.py) and [CI workflow](https://github.com/arthur-fay/inventory-reservations-api/actions/workflows/ci.yml).

The service locks a product row before changing its counters, reservation state or movement ledger. Reservation and adjustment creation store UUID retry keys; same-key requests for different products are resolved by unique constraints, with the losing transaction rolled back. Fulfillment and cancellation are repeatable terminal actions. PostgreSQL check constraints, foreign keys, bounded inputs and sanitized errors provide additional boundaries.

## Verification

The final-head **PostgreSQL integration and concurrency tests** and **Docker Compose startup, demo and restart persistence** jobs both passed:

- **55 tests passed**, including 21 database-free tests and 34 PostgreSQL integration cases.
- **98.51% application coverage**, with branch measurement enabled and a 90% combined coverage gate. This is a test-coverage measurement, not a production reliability or scale estimate.
- Concurrency cases use actual PostgreSQL 17 transactions and lock waits. They cover overselling, parallel retries, competing fulfillment/cancellation, stock corrections racing reservations, cross-product unique-key conflicts and timeout/retry behavior.
- Independent SQL after every integration test reconciles each product's physical stock to its ledger and its reserved counter to active reservations.
- Migration upgrade, downgrade and ORM/schema consistency checks passed. Alembic uses the platform path separator explicitly.
- Compose built the runtime, applied migrations before readiness, ran the asserted HTTP scenario, restarted the API and verified that stock persisted. The documented container test command also passed.
- Ruff lint/format and committed OpenAPI contract checks passed. The local workspace has no Docker or PostgreSQL executable; the full system checks were completed in GitHub Actions.

## Recruiting presentation

The GitHub profile now leads with the Inventory API in its project table. Its root README update was published as `5e716703135cffeb19c09f5370c0065b5329f4e4`. The maintained [profile text](github-profile/README.md) includes the same links and scope.

The portfolio names the project in the hero and makes its local run guide and database race tests the first backend review links. Its four expanded case-study plates remain selected examples; the statistics label now says **Featured plates**. The About note correctly counts four implementation repositories documenting five independent projects. The source and run guide are public; the API runs locally on synthetic data.

No employer code, operational dataset, customer information or production credential is included. Shared-key operator access is a local demonstration boundary, without accounts, roles, payments, multi-item orders, automatic expiry or a production deployment claim. Existing ATLAS data, release and publication gates are unchanged.

The portfolio change follows its existing PR checks for site integrity, unit tests, browser behavior and visual captures. No shared CSS or JavaScript runtime asset changed.
