import { render, screen, waitFor } from "@testing-library/react";
import { SectorPanel } from "../../app/components/Controls/SectorPanel";

// Mock lib/api to avoid real HTTP calls in tests
jest.mock("../../lib/api", () => ({
  fetchLayerData: jest.fn().mockRejectedValue(new Error("API offline")),
}));

it("shows click-prompt when no sector is selected", () => {
  render(<SectorPanel sectorId={null} dateFrom="2024-06-01" dateTo="2024-07-24" interpolated={null} />);
  expect(screen.getByText(/Click anywhere on the map/i)).toBeInTheDocument();
});

it("shows loading state immediately after a sector is set", () => {
  render(<SectorPanel sectorId="sector_1057_-2361" dateFrom="2024-06-01" dateTo="2024-07-24" interpolated={null} />);
  expect(screen.getByText(/Loading/i)).toBeInTheDocument();
});

it("renders mock sector data after API fallback resolves", async () => {
  render(<SectorPanel sectorId="sector_1057_-2361" dateFrom="2024-06-01" dateTo="2024-07-24" interpolated={null} />);
  await waitFor(() => {
    expect(screen.getByText(/Forest regrowth/i)).toBeInTheDocument();
  });
});

it("shows estimated-data warning when API is offline", async () => {
  render(<SectorPanel sectorId="sector_1057_-2361" dateFrom="2024-06-01" dateTo="2024-07-24" interpolated={null} />);
  await waitFor(() => {
    expect(screen.getByText(/Estimated data/i)).toBeInTheDocument();
  });
});

it("shows the date range in the footer", async () => {
  render(<SectorPanel sectorId="sector_1057_-2361" dateFrom="2024-06-01" dateTo="2024-07-24" interpolated={null} />);
  await waitFor(() => {
    expect(screen.getByText(/2024-06-01/)).toBeInTheDocument();
  });
});
