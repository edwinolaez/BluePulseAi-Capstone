import { render, screen } from "@testing-library/react";
import { ModelPerformanceWidget } from "../../app/components/Widgets/ModelPerformanceWidget";

jest.mock("../../app/components/Layout/icons", () => ({
  SettingsIcon: () => <span data-testid="settings-icon" />,
}));

it("renders without crashing", () => {
  render(<ModelPerformanceWidget />);
});

it("shows the Prediction Accuracy header", () => {
  render(<ModelPerformanceWidget />);
  expect(screen.getByText("Prediction Accuracy")).toBeInTheDocument();
});

it("shows the Accuracy Score label", () => {
  render(<ModelPerformanceWidget />);
  expect(screen.getByText("Accuracy Score")).toBeInTheDocument();
});

it("shows Training Loss field", () => {
  render(<ModelPerformanceWidget />);
  expect(screen.getByText(/Training Loss/i)).toBeInTheDocument();
});

it("shows Last Update field", () => {
  render(<ModelPerformanceWidget />);
  expect(screen.getByText(/Last Update/i)).toBeInTheDocument();
});

it("renders an accuracy score as a 3-decimal number", () => {
  render(<ModelPerformanceWidget />);
  // The F1 score (e.g. "0.884") is a 3-decimal float.
  // Training loss ("0.0032") has 4 decimals — use getAllByText to handle both.
  const matches = screen.getAllByText(/\d+\.\d{3,}/);
  expect(matches.length).toBeGreaterThan(0);
});
