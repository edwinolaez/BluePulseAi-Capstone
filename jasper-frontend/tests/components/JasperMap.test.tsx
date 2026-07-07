import { forwardRef } from "react";
import { render, screen } from "@testing-library/react";
import JasperMap from "../../app/components/Map/JasperMap";

jest.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: forwardRef<unknown, { children?: React.ReactNode }>(({ children }, _ref) => (
    <div>{children}</div>
  )),
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Circle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Polyline: () => <div />,
  useMap: () => ({}),
  useMapEvents: () => null,
}));

it("renders the map container and tile layer", () => {
  render(<JasperMap />);
  expect(screen.getByTestId("map-container")).toBeInTheDocument();
  expect(screen.getByTestId("tile-layer")).toBeInTheDocument();
});
