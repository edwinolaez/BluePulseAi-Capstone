import { render, screen } from "@testing-library/react";
import { forwardRef } from "react";
import { ContaminantLayer } from "../../app/components/Map/ContaminantLayer";

jest.mock("../../lib/api", () => ({
  fetchContaminantSimulation: jest.fn().mockRejectedValue(new Error("API offline")),
}));

jest.mock("react-leaflet", () => ({
  Polyline: () => <div data-testid="river-polyline" />,
  Circle:   ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip:  ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Marker:   forwardRef<unknown, { children?: React.ReactNode }>(({ children }, _ref) => <div>{children}</div>),
  Popup:    ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap:   () => ({ getZoom: () => 12, on: () => {}, off: () => {} }),
}));

jest.mock("leaflet", () => ({
  divIcon: () => ({}),
}));

it("renders the contaminant layer without crashing", () => {
  render(<ContaminantLayer />);
});

it("renders river polylines", () => {
  render(<ContaminantLayer />);
  expect(screen.getAllByTestId("river-polyline").length).toBeGreaterThanOrEqual(2);
});

it("renders the River Flow Warning hazard zone", () => {
  render(<ContaminantLayer />);
  expect(screen.getAllByText(/River Flow Warning/i).length).toBeGreaterThan(0);
});

it("renders the River Water Quality popup title", () => {
  render(<ContaminantLayer />);
  expect(screen.getAllByText(/River Water Quality/i).length).toBeGreaterThan(0);
});
