# benchmark_api.py — API Performance Benchmark Tests
#
# These tests measure HOW FAST the API responds.
# They don't just check "did it work?" — they check "did it work fast enough?"
#
# The target from our performance gate (Stage 6 CI) is:
#   P95 response time < 500ms
#
# P95 means: "95% of all requests finish within this time."
# In plain terms: if we call the API 100 times, at most 5 can be slow.
# The other 95 must all respond within 500ms.
#
# Why 500ms? Research shows users notice lag above ~500ms.
# For a live monitoring dashboard, slow data = slow decisions.
#
# Owner: Edwin (QA)
# Activates: Sprint 3 (Stage 6 of CI pipeline)
# Run manually: pytest benchmark_api.py --benchmark-json=results.json

import pytest
import httpx
import os
import statistics
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")

BASE_API_URL = os.getenv("RAILWAY_API_URL", "http://localhost:8000")
KONG_API_KEY = os.getenv("NEXT_PUBLIC_API_KEY", "")

# The performance budget: 95th percentile must be under this value (milliseconds)
P95_BUDGET_MS = 500


def measure_response_times(endpoint: str, method: str = "GET",
                            payload: dict = None, n: int = 20) -> list:
    """
    Sends `n` requests to an endpoint and collects response times in milliseconds.

    We use 20 requests by default — enough to get a meaningful P95 without
    hammering the server or making CI slow.

    Returns a list of floats, e.g. [123.4, 98.2, 210.1, ...]
    """
    headers = {"X-API-Key": KONG_API_KEY}
    times = []

    with httpx.Client(base_url=BASE_API_URL, timeout=10.0) as client:
        for _ in range(n):
            if method == "GET":
                response = client.get(endpoint, headers=headers)
            else:
                response = client.post(endpoint, json=payload, headers=headers)

            # elapsed is the total round-trip time from sending to receiving
            elapsed_ms = response.elapsed.total_seconds() * 1000
            times.append(elapsed_ms)

    return times


def calculate_p95(times: list) -> float:
    """
    Calculates the 95th percentile from a list of response times.

    Sorts the times from fastest to slowest, then finds the value
    at the 95% mark. Example with 20 results:
    - Sort all 20 times
    - P95 = the value at position 19 (the 19th out of 20 sorted values)
    - This means 95% of requests were faster than this value
    """
    sorted_times = sorted(times)
    # Index for P95: round up to avoid float index
    index = int(len(sorted_times) * 0.95) - 1
    index = max(0, index)
    return sorted_times[index]


# ─── Health Endpoint Benchmark ────────────────────────────────────────────────

class TestHealthEndpointPerformance:
    """
    The /health endpoint should be the fastest in the system.
    It just checks if the server is alive — no DB queries, no ML inference.
    Target: P95 < 200ms (tighter budget than other endpoints).
    """

    HEALTH_BUDGET_MS = 200  # health check must be faster than normal endpoints

    def test_health_endpoint_p95_under_200ms(self):
        """
        Sends 20 requests to /health and checks the P95 response time.

        If this fails it usually means:
        - Railway's server is overloaded
        - There's network latency between CI and Railway
        - The health handler is doing unnecessary work (e.g. DB ping)
        """
        times = measure_response_times("/health", n=20)
        p95 = calculate_p95(times)
        avg = statistics.mean(times)

        print(f"\n/health performance: avg={avg:.1f}ms, P95={p95:.1f}ms")

        assert p95 < self.HEALTH_BUDGET_MS, (
            f"/health P95 is {p95:.1f}ms — exceeds the {self.HEALTH_BUDGET_MS}ms budget. "
            f"Average was {avg:.1f}ms. "
            "The health endpoint should not make any DB calls."
        )


# ─── Map Query Endpoint Benchmark ─────────────────────────────────────────────

class TestMapQueryPerformance:
    """
    The map query endpoint (GET /api/v1/layers/{sector_id}) hits the PostGIS
    database and runs spatial queries. It's allowed up to 500ms P95.

    This is the most critical endpoint for user experience:
    every time someone pans the map, this endpoint is called.
    """

    def test_map_query_p95_under_500ms(self):
        """
        Sends 20 requests to the map query endpoint and checks P95 < 500ms.

        If this is slow, likely causes:
        - Missing PostGIS spatial index on sector_id or coordinates
        - Rahil's DB is on the free Railway tier (limited CPU)
        - Kong is doing extra work (rate limit checks add ~10ms)
        """
        times = measure_response_times("/api/v1/layers/ATH-001", n=20)
        p95 = calculate_p95(times)
        avg = statistics.mean(times)

        print(f"\n/api/v1/layers/ATH-001 performance: avg={avg:.1f}ms, P95={p95:.1f}ms")

        assert p95 < P95_BUDGET_MS, (
            f"Map query P95 is {p95:.1f}ms — exceeds the {P95_BUDGET_MS}ms budget. "
            f"Average was {avg:.1f}ms. "
            "Rahil: check PostGIS indexes. Edwin: attach this output to the M3 report."
        )


# ─── ML Inference Benchmark ───────────────────────────────────────────────────

class TestMLInferencePerformance:
    """
    ML inference (running the model) is the slowest operation in the system.
    We still target P95 < 500ms — Richard's model must be optimised for this.

    Note: first request may be slow (model loading into memory). We warm up
    the endpoint with one throwaway request before measuring.
    """

    def test_change_detection_p95_under_500ms(self):
        """
        Sends 20 requests to the change detection endpoint.

        If this is consistently over 500ms, Richard should:
        1. Keep the model loaded in memory (not re-loaded per request)
        2. Consider model quantization (smaller model = faster inference)
        3. Cache results for repeated sector+date combinations
        """
        payload = {"sector_id": "ATH-001", "imagery_date": "2026-06-25"}

        # Warm up: one request to load the model into memory
        # (we don't count this in the measurements)
        with httpx.Client(base_url=BASE_API_URL, timeout=30.0) as client:
            client.post(
                "/predict/change-detection",
                json=payload,
                headers={"X-API-Key": KONG_API_KEY}
            )

        # Now measure 20 real requests
        times = measure_response_times(
            "/predict/change-detection",
            method="POST",
            payload=payload,
            n=20
        )
        p95 = calculate_p95(times)
        avg = statistics.mean(times)

        print(f"\n/predict/change-detection performance: avg={avg:.1f}ms, P95={p95:.1f}ms")

        assert p95 < P95_BUDGET_MS, (
            f"Change detection P95 is {p95:.1f}ms — exceeds the {P95_BUDGET_MS}ms budget. "
            f"Average was {avg:.1f}ms. "
            "Richard: keep the model in memory between requests using a module-level variable."
        )

    def test_contaminant_simulation_p95_under_500ms(self):
        """
        Contaminant simulation is the most computationally expensive model.
        It simulates hydrocarbon spread using SciPy's ODE solver.

        If this fails: Richard may need to reduce simulation resolution
        or pre-compute common spread patterns.
        """
        payload = {
            "sector_id": "ATH-001",
            "source_point": {"lat": 56.72, "lon": -111.37}
        }

        # Warm up
        with httpx.Client(base_url=BASE_API_URL, timeout=30.0) as client:
            client.post(
                "/simulate/contaminant",
                json=payload,
                headers={"X-API-Key": KONG_API_KEY}
            )

        times = measure_response_times(
            "/simulate/contaminant",
            method="POST",
            payload=payload,
            n=20
        )
        p95 = calculate_p95(times)
        avg = statistics.mean(times)

        print(f"\n/simulate/contaminant performance: avg={avg:.1f}ms, P95={p95:.1f}ms")

        assert p95 < P95_BUDGET_MS, (
            f"Contaminant simulation P95 is {p95:.1f}ms — exceeds {P95_BUDGET_MS}ms. "
            f"Average was {avg:.1f}ms. "
            "Consider caching simulation results for repeated sector+source combinations."
        )


# ─── Summary Report ───────────────────────────────────────────────────────────

class TestPerformanceSummary:
    """
    Produces a human-readable summary for the M3/M5 Test Completion Report.

    Run this with: pytest benchmark_api.py::TestPerformanceSummary -s
    The -s flag shows the print() output in your terminal.
    """

    def test_print_performance_report(self, capsys):
        """
        Measures all endpoints and prints a formatted summary table.
        This output goes into Edwin's Test Completion Report.
        """
        endpoints = [
            ("/health", "GET", None, "Health Check"),
            ("/api/v1/layers/ATH-001", "GET", None, "Map Query"),
        ]

        print("\n")
        print("=" * 60)
        print("PROJECT JASPER — API PERFORMANCE REPORT")
        print(f"P95 Budget: {P95_BUDGET_MS}ms | Date: 2026-06-25")
        print("=" * 60)
        print(f"{'Endpoint':<30} {'Avg (ms)':>10} {'P95 (ms)':>10} {'Status':>10}")
        print("-" * 60)

        all_passed = True

        for path, method, payload, label in endpoints:
            try:
                times = measure_response_times(path, method, payload, n=10)
                avg = statistics.mean(times)
                p95 = calculate_p95(times)
                status = "PASS" if p95 < P95_BUDGET_MS else "FAIL"
                if status == "FAIL":
                    all_passed = False
                print(f"{label:<30} {avg:>10.1f} {p95:>10.1f} {status:>10}")
            except Exception as e:
                print(f"{label:<30} {'N/A':>10} {'N/A':>10} {'SKIP':>10}  ({e})")

        print("=" * 60)

        # The report is informational — we don't fail the test itself here
        # so it always prints even when some endpoints aren't live yet
        assert True
