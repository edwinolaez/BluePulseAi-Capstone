import { render, screen } from "@testing-library/react";
import { forwardRef } from "react";
import { BurnScarLayer } from "../../app/components/Map/BurnScarLayer";

jest.mock("../../lib/api", () => ({
  fetchChangeDetection: jest.fn().mockRejectedValue(new Error("API offline")),
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

it("renders the burn scar hazard zone without crashing", () => {
  render(<BurnScarLayer />);
});

it("renders the forest regrowth label", () => {
  render(<BurnScarLayer />);
  expect(screen.getAllByText(/Forest Regrowth Monitor/i).length).toBeGreaterThan(0);
});
