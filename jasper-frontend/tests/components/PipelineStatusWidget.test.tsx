import { render, screen } from "@testing-library/react";
import { PipelineStatusWidget } from "../../app/components/Widgets/PipelineStatusWidget";

// Mock icon so SVG doesn't break in jsdom
jest.mock("../../app/components/Layout/icons", () => ({
  SyncIcon: () => <span data-testid="sync-icon" />,
}));

it("renders without crashing", () => {
  render(<PipelineStatusWidget />);
});

it("shows the Data Connection header", () => {
  render(<PipelineStatusWidget />);
  expect(screen.getByText("Data Connection")).toBeInTheDocument();
});

it("shows the Satellite Updates row", () => {
  render(<PipelineStatusWidget />);
  expect(screen.getByText("Satellite Updates")).toBeInTheDocument();
});

it("shows the Active status badge", () => {
  render(<PipelineStatusWidget />);
  expect(screen.getByText("Active")).toBeInTheDocument();
});

it("shows the IoT Jasper-A1 row", () => {
  render(<PipelineStatusWidget />);
  expect(screen.getByText("IoT Jasper-A1")).toBeInTheDocument();
});

it("shows a percentage value for satellite updates", () => {
  render(<PipelineStatusWidget />);
  expect(screen.getByText(/\d+%/)).toBeInTheDocument();
});
