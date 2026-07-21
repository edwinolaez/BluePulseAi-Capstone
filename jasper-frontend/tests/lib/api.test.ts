// Tests for lib/api.ts — the module that connects the frontend to
// Feven's backend (layer data) and Richard's ML API (burn scar, erosion, contaminant).
// We mock fetch globally so no real HTTP calls are made.

import {
  fetchLayerData,
  fetchChangeDetection,
  fetchErosionSimulation,
  fetchContaminantSimulation,
} from "../../lib/api";

// Build a minimal fetch response helper
function mockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

const MOCK_LAYER_DATA = {
  sector_id: "ATH-001-A",
  date_from: "2024-01-01",
  date_to: "2024-12-31",
  layer_type: "burn",
  layers: [],
};

const MOCK_MODEL_OUTPUT = {
  sector_id:          "ATH-001-A",
  model_version:      "v1.3.0",
  simulation_type:    "change_detection",
  risk_score:         0.82,
  risk_label:         "High",
  contaminant_vector: { direction_deg: 180, velocity: 0.5 },
  timestamp:          "2024-07-01T12:00:00Z",
  confidence:         0.946,
};

beforeEach(() => {
  // Replace the global fetch with a Jest mock before each test
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── fetchLayerData ──────────────────────────────────────────────────────────

describe("fetchLayerData", () => {
  it("calls the correct URL with the right query params", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(MOCK_LAYER_DATA));
    await fetchLayerData("ATH-001-A", "2024-01-01", "2024-12-31", "burn");
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/api/v1/layers/ATH-001-A");
    expect(url).toContain("date_from=2024-01-01");
    expect(url).toContain("layer_type=burn");
  });

  it("sends the X-API-Key header", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(MOCK_LAYER_DATA));
    await fetchLayerData("ATH-001-A", "2024-01-01", "2024-12-31", "burn");
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers).toHaveProperty("X-API-Key");
  });

  it("returns the parsed JSON on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(MOCK_LAYER_DATA));
    const result = await fetchLayerData("ATH-001-A", "2024-01-01", "2024-12-31", "burn");
    expect(result.sector_id).toBe("ATH-001-A");
    expect(result.layers).toEqual([]);
  });

  it("throws when the response is not OK", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse({}, 500));
    await expect(
      fetchLayerData("ATH-001-A", "2024-01-01", "2024-12-31", "burn")
    ).rejects.toThrow("Layer fetch failed: 500");
  });
});

// ─── fetchChangeDetection ────────────────────────────────────────────────────

describe("fetchChangeDetection", () => {
  it("sends a POST request to the change-detection endpoint", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(MOCK_MODEL_OUTPUT));
    await fetchChangeDetection("ATH-001-A");
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/predict/change-detection");
    expect(options.method).toBe("POST");
  });

  it("includes the sector_id in the POST body", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(MOCK_MODEL_OUTPUT));
    await fetchChangeDetection("ATH-001-A");
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ sector_id: "ATH-001-A" });
  });

  it("sends Content-Type and X-API-Key headers", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(MOCK_MODEL_OUTPUT));
    await fetchChangeDetection("ATH-001-A");
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers).toHaveProperty("X-API-Key");
  });

  it("returns the model output on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(MOCK_MODEL_OUTPUT));
    const result = await fetchChangeDetection("ATH-001-A");
    expect(result.risk_label).toBe("High");
    expect(result.confidence).toBe(0.946);
  });

  it("throws when the server returns an error status", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse({}, 422));
    await expect(fetchChangeDetection("ATH-001-A")).rejects.toThrow(
      "Change detection failed: 422"
    );
  });
});

// ─── fetchErosionSimulation ──────────────────────────────────────────────────

describe("fetchErosionSimulation", () => {
  it("sends a POST request to the erosion endpoint with a JSON body", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(MOCK_MODEL_OUTPUT));
    await fetchErosionSimulation("ATH-001-H", 95, { lat: 52.858, lon: -118.092 });
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/simulate/erosion");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      sector_id: "ATH-001-H",
      rainfall_mm: 95,
      coordinates: { lat: 52.858, lon: -118.092 },
    });
  });

  it("omits rainfall_mm and coordinates when not provided", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(MOCK_MODEL_OUTPUT));
    await fetchErosionSimulation("ATH-001-H");
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ sector_id: "ATH-001-H" });
  });

  it("returns the model output on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(MOCK_MODEL_OUTPUT));
    const result = await fetchErosionSimulation("ATH-001-H", 95);
    expect(result.risk_score).toBe(0.82);
  });

  it("throws when the server returns an error status", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse({}, 503));
    await expect(fetchErosionSimulation("ATH-001-H", 95)).rejects.toThrow(
      "Erosion simulation failed: 503"
    );
  });
});

// ─── fetchContaminantSimulation ──────────────────────────────────────────────

describe("fetchContaminantSimulation", () => {
  const SOURCE_POINT = { lat: 52.8639, lon: -118.1069 };

  it("sends a POST request to the contaminant endpoint with a JSON body", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(MOCK_MODEL_OUTPUT));
    await fetchContaminantSimulation("ATH-001-W", SOURCE_POINT);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/simulate/contaminant");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      sector_id: "ATH-001-W",
      source_point: SOURCE_POINT,
    });
  });

  it("returns the model output on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(MOCK_MODEL_OUTPUT));
    const result = await fetchContaminantSimulation("ATH-001-W", SOURCE_POINT);
    expect(result.risk_label).toBe("High");
  });

  it("throws when the server returns an error status", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse({}, 404));
    await expect(fetchContaminantSimulation("ATH-001-W", SOURCE_POINT)).rejects.toThrow(
      "Contaminant simulation failed: 404"
    );
  });
});
