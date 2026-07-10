import { render, screen } from "@testing-library/react";
import { WaterQualityWidget } from "../../app/components/Widgets/WaterQualityWidget";

it("renders without crashing", () => {
  render(<WaterQualityWidget />);
});

it("shows the Water Cloudiness header", () => {
  render(<WaterQualityWidget />);
  // Multiple "Water Cloudiness" elements exist — header + sub-label — both are correct
  expect(screen.getAllByText("Water Cloudiness").length).toBeGreaterThanOrEqual(1);
});

it("shows the Turbidity (NTU) unit label", () => {
  render(<WaterQualityWidget />);
  expect(screen.getByText("NTU")).toBeInTheDocument();
});

it("shows the Acidity (pH) label", () => {
  render(<WaterQualityWidget />);
  expect(screen.getByText(/Acidity/i)).toBeInTheDocument();
});

it("shows the pH unit label", () => {
  render(<WaterQualityWidget />);
  expect(screen.getByText("pH")).toBeInTheDocument();
});

it("shows the live indicator", () => {
  render(<WaterQualityWidget />);
  expect(screen.getByText("Live")).toBeInTheDocument();
});
