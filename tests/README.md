# tests

**Owner:** Edwin | Integration tests, API contract tests, regression suite

## Structure

```
tests/
  test_ingest_pipeline.py       # Sprint 2: ingest → PostGIS → API end-to-end
  test_api_contracts.py         # Sprint 2: Feven's endpoint contract tests
  test_rbac.py                  # Sprint 2: RBAC role/action coverage
  test_ml_endpoints.py          # Sprint 3: Richard's ML model endpoints
  test_fusion_endpoint.py       # Sprint 3: Feven's multi-source fusion
  benchmark_api.py              # Sprint 3: pytest-benchmark API response times
  requirements.txt              # pytest httpx pytest-asyncio pytest-benchmark
```

## Run

```bash
cd tests/
pip install -r requirements.txt
pytest --tb=short
```

## Coverage target

- Backend: >= 80%
- Frontend: >= 75%
- 100% of API endpoints contract-tested by M3
