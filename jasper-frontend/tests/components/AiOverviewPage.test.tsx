import { render, screen, waitFor } from "@testing-library/react";
import { AiOverviewPage } from "../../app/components/Pages/AiOverviewPage";

// Mock ResearcherChatPanel — it uses scrollIntoView which jsdom doesn't implement,
// and it has its own test suite, so we don't need to render it here.
jest.mock("../../app/components/Widgets/ResearcherChatPanel", () => ({
  ResearcherChatPanel: () => null,
}));

// Mock the API functions from lib/api so tests don't make real HTTP calls.
// In the default mock they never resolve, so the page stays in loading state —
// individual tests can override this to test resolved data.
const mockFetchChangeDetection      = jest.fn();
const mockFetchErosionSimulation    = jest.fn();
const mockFetchContaminantSimulation = jest.fn();

jest.mock("../../lib/api", () => ({
  fetchChangeDetection:       (...args: unknown[]) => mockFetchChangeDetection(...args),
  fetchErosionSimulation:     (...args: unknown[]) => mockFetchErosionSimulation(...args),
  fetchContaminantSimulation: (...args: unknown[]) => mockFetchContaminantSimulation(...args),
}));

beforeEach(() => {
  // Default: API calls are pending (promises that never resolve)
  // This lets us check the initial/loading state in tests
  mockFetchChangeDetection.mockReturnValue(new Promise(() => {}));
  mockFetchErosionSimulation.mockReturnValue(new Promise(() => {}));
  mockFetchContaminantSimulation.mockReturnValue(new Promise(() => {}));
});

it("renders the AI Model Overview heading", () => {
  render(<AiOverviewPage />);
  expect(screen.getByText("AI Model Overview")).toBeInTheDocument();
});

it("shows a description mentioning the ML models", () => {
  render(<AiOverviewPage />);
  expect(screen.getByText(/burn scar detection, erosion simulation, and contaminant tracking/i)).toBeInTheDocument();
});

it("renders a card for Forest Burn Scar Detection", () => {
  render(<AiOverviewPage />);
  expect(screen.getByText("Forest Burn Scar Detection")).toBeInTheDocument();
});

it("renders a card for Erosion Risk Simulation", () => {
  render(<AiOverviewPage />);
  expect(screen.getByText("Erosion Risk Simulation")).toBeInTheDocument();
});

it("renders a card for Contaminant Plume Tracker", () => {
  render(<AiOverviewPage />);
  expect(screen.getByText("Contaminant Plume Tracker")).toBeInTheDocument();
});

it("shows the Model Output Summary table", () => {
  render(<AiOverviewPage />);
  expect(screen.getByText("Model Output Summary")).toBeInTheDocument();
});

it("shows the loading message while API calls are in-flight", () => {
  render(<AiOverviewPage />);
  expect(screen.getByText(/Fetching live model data/i)).toBeInTheDocument();
});

it("shows mock fallback data (Estimated badge) before API resolves", () => {
  render(<AiOverviewPage />);
  // All three cards should show 'Estimated' while the calls are pending
  const estimatedBadges = screen.getAllByText("Estimated");
  expect(estimatedBadges.length).toBeGreaterThanOrEqual(1);
});

it("shows risk score bars for each model", () => {
  render(<AiOverviewPage />);
  // Each card has a 'Risk Score' label in the ScoreBar component
  const scoreBars = screen.getAllByText("Risk Score");
  expect(scoreBars).toHaveLength(3);
});

it("shows Live badges when API calls resolve successfully", async () => {
  const mockResult = { risk_label: "High", risk_score: 0.82, confidence: 0.946, model_version: "v1.3.0" };
  mockFetchChangeDetection.mockResolvedValue(mockResult);
  mockFetchErosionSimulation.mockResolvedValue({ ...mockResult, risk_label: "High", risk_score: 0.74 });
  mockFetchContaminantSimulation.mockResolvedValue({ ...mockResult, risk_label: "Medium", risk_score: 0.55 });

  render(<AiOverviewPage />);

  await waitFor(() => {
    // After all 3 API calls resolve, the "Live" badges appear
    const liveBadges = screen.getAllByText("Live");
    expect(liveBadges.length).toBeGreaterThanOrEqual(1);
  });
});

it("shows sector codes in the summary table", () => {
  render(<AiOverviewPage />);
  expect(screen.getByText("ATH-001-A")).toBeInTheDocument();
  expect(screen.getByText("ATH-001-H")).toBeInTheDocument();
  expect(screen.getByText("ATH-001-W")).toBeInTheDocument();
});
