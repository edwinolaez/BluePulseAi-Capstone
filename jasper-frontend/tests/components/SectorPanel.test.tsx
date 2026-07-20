import { render, screen } from "@testing-library/react";
import { SectorPanel } from "../../app/components/Controls/SectorPanel";

it("shows click-prompt when no sensor is selected", () => {
  render(<SectorPanel />);
  expect(screen.getByText(/Click a sensor badge/i)).toBeInTheDocument();
});

it("shows sensor info when sensorInfo is provided", () => {
  render(
    <SectorPanel
      sensorInfo={{
        icon: "mountain",
        title: "SOIL EROSION ANALYSIS",
        badge: "CRITICAL",
        badgeVariant: "red",
        name: "Slope Area ATH-001-H",
        fields: [
          { label: "AREA ID",    value: "ATH-001-H" },
          { label: "RISK LEVEL", value: "High", valueColor: "#ef4444" },
        ],
      }}
    />
  );
  expect(screen.getByText("SOIL EROSION ANALYSIS")).toBeInTheDocument();
  expect(screen.getByText("Slope Area ATH-001-H")).toBeInTheDocument();
  expect(screen.getByText("ATH-001-H")).toBeInTheDocument();
  expect(screen.getByText("CRITICAL")).toBeInTheDocument();
});

it("shows the badge with correct label", () => {
  render(
    <SectorPanel
      sensorInfo={{
        icon: "flame",
        title: "FOREST BURN SCAR",
        badge: "LOW",
        badgeVariant: "green",
        name: "Burn Scar Zone ATH-001-A",
        fields: [{ label: "STATUS", value: "Active Monitoring" }],
      }}
    />
  );
  expect(screen.getByText("LOW")).toBeInTheDocument();
});
