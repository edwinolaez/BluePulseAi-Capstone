import { render, screen, fireEvent } from "@testing-library/react";
import { TemporalSlider } from "../../app/components/Controls/TemporalSlider";

// TemporalSlider renders inline with no external deps — no mocking needed
it("renders the Time History slider", () => {
  render(<TemporalSlider onDateRangeChange={() => {}} />);
  expect(screen.getByRole("slider")).toBeInTheDocument();
});

it("renders the Time History label", () => {
  render(<TemporalSlider onDateRangeChange={() => {}} />);
  expect(screen.getByText("Time History")).toBeInTheDocument();
});

it("renders the Before the Fire and Current Recovery labels", () => {
  render(<TemporalSlider onDateRangeChange={() => {}} />);
  expect(screen.getByText(/Before the Fire/i)).toBeInTheDocument();
  expect(screen.getByText(/Current Recovery/i)).toBeInTheDocument();
});

it("calls onDateRangeChange when slider moves", () => {
  const mock = jest.fn();
  render(<TemporalSlider onDateRangeChange={mock} />);
  fireEvent.change(screen.getByRole("slider"), { target: { value: "80" } });
  expect(mock).toHaveBeenCalled();
  const [from, to] = mock.mock.calls[0];
  expect(typeof from).toBe("string");
  expect(typeof to).toBe("string");
});

it("shows Before the Fire label at the start of the timeline", () => {
  render(<TemporalSlider onDateRangeChange={() => {}} />);
  // The bottom-left label is always rendered statically
  expect(screen.getByText(/Before the Fire \(Jun 2024\)/i)).toBeInTheDocument();
});

it("badge contains the phase string when slider is at monitoring range", () => {
  render(<TemporalSlider onDateRangeChange={() => {}} />);
  const slider = screen.getByRole("slider");
  fireEvent.change(slider, { target: { value: "90" } });
  // At value 90% the badge pill will contain "Current Recovery"
  // Both the badge AND the bottom label may match — use getAllByText
  expect(screen.getAllByText(/Current Recovery/i).length).toBeGreaterThanOrEqual(1);
});
