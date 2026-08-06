import { render, screen } from "@testing-library/react";
import { forwardRef } from "react";
import { ErosionLayer } from "../../app/components/Map/ErosionLayer";

jest.mock("../../lib/api", () => ({
  fetchErosionSimulation: jest.fn().mockRejectedValue(new Error("API offline")),
}));

// FIX (Aug 6 2026): Added Polygon to the react-leaflet mock. ErosionLayer renders
// zone boundaries using <Polygon>, which was missing from the mock, causing React to
// throw "Element type is invalid: got undefined" and crashing the entire test suite.
jest.mock("react-leaflet", () => ({
  Circle:       ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CircleMarker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Polygon:      ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip:      ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Marker:       forwardRef<unknown, { children?: React.ReactNode }>(({ children }, _ref) => <div>{children}</div>),
  Popup:        ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap:       () => ({ getZoom: () => 12, on: () => {}, off: () => {} }),
}));

jest.mock("leaflet", () => ({
  divIcon: () => ({}),
}));

it("renders the erosion layer without crashing", () => {
  render(<ErosionLayer />);
});

it("renders erosion risk labels for each zone", () => {
  render(<ErosionLayer />);
  // Each zone tooltip shows an "Erosion Risk" badge while the ML call is pending
  const labels = screen.getAllByText(/Erosion Risk/i);
  expect(labels.length).toBeGreaterThanOrEqual(1);
});

it("renders the soil erosion sensor label", () => {
  render(<ErosionLayer />);
  expect(screen.getAllByText(/Soil Erosion Sensor/i).length).toBeGreaterThan(0);
});
