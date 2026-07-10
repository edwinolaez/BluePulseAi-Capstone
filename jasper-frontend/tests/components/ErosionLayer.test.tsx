import { render, screen } from "@testing-library/react";
import { forwardRef } from "react";
import { ErosionLayer } from "../../app/components/Map/ErosionLayer";

jest.mock("../../lib/api", () => ({
  fetchErosionSimulation: jest.fn().mockRejectedValue(new Error("API offline")),
}));

jest.mock("react-leaflet", () => ({
  Circle:  ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Marker:  forwardRef<unknown, { children?: React.ReactNode }>(({ children }, _ref) => <div>{children}</div>),
  Popup:   ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap:  () => ({ getZoom: () => 12, on: () => {}, off: () => {} }),
}));

jest.mock("leaflet", () => ({
  divIcon: () => ({}),
}));

it("renders the erosion layer without crashing", () => {
  render(<ErosionLayer />);
});

it("renders all three risk tier labels", () => {
  render(<ErosionLayer />);
  const labels = screen.getAllByText(/Landslide & Soil Risk|Soil Erosion Risk/i);
  expect(labels.length).toBeGreaterThanOrEqual(3);
});

it("renders the Soil Erosion Analysis popup title", () => {
  render(<ErosionLayer />);
  expect(screen.getAllByText(/Soil Erosion Analysis/i).length).toBeGreaterThan(0);
});
