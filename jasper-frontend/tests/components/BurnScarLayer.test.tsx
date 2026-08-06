import { render, screen } from "@testing-library/react";
import { forwardRef } from "react";
import { BurnScarLayer } from "../../app/components/Map/BurnScarLayer";

jest.mock("../../lib/api", () => ({
  fetchChangeDetection: jest.fn().mockRejectedValue(new Error("API offline")),
}));

// FIX (Aug 6 2026): Added Polygon to the react-leaflet mock. BurnScarLayer renders
// burn-scar zone boundaries using <Polygon>, which was missing from the mock, causing
// React to throw "Element type is invalid: got undefined" and crashing the test suite.
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

it("renders the burn scar hazard zone without crashing", () => {
  render(<BurnScarLayer />);
});

it("renders the forest regrowth sensor label", () => {
  render(<BurnScarLayer />);
  expect(screen.getAllByText(/Forest Regrowth Sensor/i).length).toBeGreaterThan(0);
});
