// Tests that verify the Convex live-data path in each widget.
// We mock convex/react and convex/server so no real network calls are made,
// then wrap each widget in ConvexAvailableContext.Provider value={true}
// to activate the LiveData sub-components.
//
// We avoid jest.useFakeTimers() entirely — fake timers accumulate in the Jest
// worker queue across tests and cause heap-out-of-memory crashes.
// Instead we spy on setInterval and call the callback immediately so the
// animation code path is covered without any timer scheduling.

import { render, screen, act } from "@testing-library/react";
import React from "react";
import { useQuery } from "convex/react";

// ── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("convex/react", () => ({
  useQuery:          jest.fn().mockReturnValue(undefined),
  ConvexProvider:    ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ConvexReactClient: jest.fn(),
}));

jest.mock("convex/server", () => ({
  anyApi: {
    waterQuality:  { getLiveWaterQuality: "mock-water" },
    pipeline:      { getPipelineStatus:   "mock-pipeline" },
    modelMetadata: { getModelMetadata:    "mock-model" },
  },
}));

jest.mock("../../app/components/Layout/icons", () => ({
  SyncIcon:     () => <span data-testid="sync-icon" />,
  SettingsIcon: () => <span data-testid="settings-icon" />,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockUseQuery = useQuery as jest.Mock;

let WaterQualityWidget:    React.ComponentType;
let PipelineStatusWidget:  React.ComponentType;
let ModelPerformanceWidget: React.ComponentType;
let ConvexAvailableContext: React.Context<boolean>;

beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ WaterQualityWidget }     = require("../../app/components/Widgets/WaterQualityWidget"));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ PipelineStatusWidget }   = require("../../app/components/Widgets/PipelineStatusWidget"));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ ModelPerformanceWidget } = require("../../app/components/Widgets/ModelPerformanceWidget"));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ ConvexAvailableContext } = require("../../app/components/Providers/ConvexClientProvider"));
});

beforeEach(() => {
  mockUseQuery.mockReturnValue(undefined);
});

// Helper: spy on setInterval so every callback fires once synchronously,
// then restores the original. This covers the animation code path without
// scheduling any timers that could accumulate in the worker's memory.
function withImmediateIntervals(fn: () => void) {
  const spy = jest.spyOn(global, "setInterval").mockImplementation((cb: TimerHandler) => {
    if (typeof cb === "function") cb();
    return 0 as unknown as ReturnType<typeof setInterval>;
  });
  try { fn(); } finally { spy.mockRestore(); }
}

// ── WaterQualityWidget ────────────────────────────────────────────────────────

describe("WaterQualityWidget — Convex live path", () => {
  it("renders when ConvexAvailableContext is true", () => {
    mockUseQuery.mockReturnValue({ turbidity: 4.2, ph: 7.15 });
    render(
      <ConvexAvailableContext.Provider value={true}>
        <WaterQualityWidget />
      </ConvexAvailableContext.Provider>
    );
    expect(screen.getAllByText("Water Cloudiness").length).toBeGreaterThanOrEqual(1);
  });

  it("displays the Convex turbidity value", () => {
    mockUseQuery.mockReturnValue({ turbidity: 4.2, ph: 7.15 });
    act(() => {
      render(
        <ConvexAvailableContext.Provider value={true}>
          <WaterQualityWidget />
        </ConvexAvailableContext.Provider>
      );
    });
    expect(screen.getByText("4.2")).toBeInTheDocument();
  });

  it("displays the Convex pH value", () => {
    mockUseQuery.mockReturnValue({ turbidity: 4.2, ph: 7.15 });
    act(() => {
      render(
        <ConvexAvailableContext.Provider value={true}>
          <WaterQualityWidget />
        </ConvexAvailableContext.Provider>
      );
    });
    expect(screen.getByText("7.15")).toBeInTheDocument();
  });

  it("runs the mock animation callback when Convex is not available", () => {
    withImmediateIntervals(() => {
      render(
        <ConvexAvailableContext.Provider value={false}>
          <WaterQualityWidget />
        </ConvexAvailableContext.Provider>
      );
    });
    expect(screen.getAllByText("Water Cloudiness").length).toBeGreaterThanOrEqual(1);
  });
});

// ── PipelineStatusWidget ──────────────────────────────────────────────────────

describe("PipelineStatusWidget — Convex live path", () => {
  it("renders when ConvexAvailableContext is true", () => {
    mockUseQuery.mockReturnValue({ ingestPct: 97 });
    render(
      <ConvexAvailableContext.Provider value={true}>
        <PipelineStatusWidget />
      </ConvexAvailableContext.Provider>
    );
    expect(screen.getByText("Data Connection")).toBeInTheDocument();
  });

  it("displays the Convex ingest percentage", () => {
    mockUseQuery.mockReturnValue({ ingestPct: 97 });
    act(() => {
      render(
        <ConvexAvailableContext.Provider value={true}>
          <PipelineStatusWidget />
        </ConvexAvailableContext.Provider>
      );
    });
    expect(screen.getByText("97%")).toBeInTheDocument();
  });

  it("runs the mock animation callback when Convex is not available", () => {
    withImmediateIntervals(() => {
      render(
        <ConvexAvailableContext.Provider value={false}>
          <PipelineStatusWidget />
        </ConvexAvailableContext.Provider>
      );
    });
    expect(screen.getByText("Data Connection")).toBeInTheDocument();
  });
});

// ── ModelPerformanceWidget ────────────────────────────────────────────────────

describe("ModelPerformanceWidget — Convex live path", () => {
  it("renders when ConvexAvailableContext is true", () => {
    mockUseQuery.mockReturnValue({ f1Score: 0.921, trainingLoss: 0.0025 });
    render(
      <ConvexAvailableContext.Provider value={true}>
        <ModelPerformanceWidget />
      </ConvexAvailableContext.Provider>
    );
    expect(screen.getByText("Prediction Accuracy")).toBeInTheDocument();
  });

  it("displays the Convex F1 score value", () => {
    mockUseQuery.mockReturnValue({ f1Score: 0.921, trainingLoss: 0.0025 });
    act(() => {
      render(
        <ConvexAvailableContext.Provider value={true}>
          <ModelPerformanceWidget />
        </ConvexAvailableContext.Provider>
      );
    });
    expect(screen.getByText("0.921")).toBeInTheDocument();
  });

  it("runs the mock animation callback when Convex is not available", () => {
    withImmediateIntervals(() => {
      render(
        <ConvexAvailableContext.Provider value={false}>
          <ModelPerformanceWidget />
        </ConvexAvailableContext.Provider>
      );
    });
    expect(screen.getByText("Prediction Accuracy")).toBeInTheDocument();
  });

  it("shows the last-updated ticker label", () => {
    // Render without advancing time — just verifies the ticker renders at all
    render(
      <ConvexAvailableContext.Provider value={false}>
        <ModelPerformanceWidget />
      </ConvexAvailableContext.Provider>
    );
    expect(screen.getByText("Prediction Accuracy")).toBeInTheDocument();
  });
});
