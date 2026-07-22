import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ResearcherChatPanel } from "../../app/components/Widgets/ResearcherChatPanel";

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

// Reset fetch mock between tests
let mockFetch: jest.Mock;
beforeEach(() => {
  mockFetch = jest.fn();
  global.fetch = mockFetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

it("renders without crashing", () => {
  render(<ResearcherChatPanel />);
});

it("shows the Jasper AI Research Assistant header", () => {
  render(<ResearcherChatPanel />);
  expect(screen.getByText("Jasper AI Research Assistant")).toBeInTheDocument();
});

it("shows the sub-header description", () => {
  render(<ResearcherChatPanel />);
  expect(screen.getByText(/Ask it to run simulations or explain model results/i)).toBeInTheDocument();
});

it("shows the Claude model badge", () => {
  render(<ResearcherChatPanel />);
  expect(screen.getByText(/claude-sonnet/i)).toBeInTheDocument();
});

it("shows the empty-state prompt when no messages exist", () => {
  render(<ResearcherChatPanel />);
  expect(screen.getByText("Ask me to run a simulation")).toBeInTheDocument();
});

it("shows all four suggested prompt chips", () => {
  render(<ResearcherChatPanel />);
  expect(screen.getByText("Run erosion simulation for ATH-001-H")).toBeInTheDocument();
  expect(screen.getByText("Check burn scar risk in sector ATH-001-A")).toBeInTheDocument();
  expect(screen.getByText("Track contaminant plume in ATH-001-W")).toBeInTheDocument();
  expect(screen.getByText("What's the current erosion risk with 120mm rainfall?")).toBeInTheDocument();
});

it("renders the textarea input with correct placeholder", () => {
  render(<ResearcherChatPanel />);
  expect(screen.getByPlaceholderText(/Ask about a simulation or sector/i)).toBeInTheDocument();
});

it("send button is disabled when input is empty", () => {
  render(<ResearcherChatPanel />);
  const btn = screen.getByRole("button", { name: /send message/i });
  expect(btn).toBeDisabled();
});

it("send button becomes enabled when user types text", () => {
  render(<ResearcherChatPanel />);
  const input = screen.getByPlaceholderText(/Ask about a simulation/i);
  fireEvent.change(input, { target: { value: "Run erosion" } });
  const btn = screen.getByRole("button", { name: /send message/i });
  expect(btn).not.toBeDisabled();
});

it("shows the user message in the thread after sending", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ reply: "Erosion risk is High — 74%." }),
  });

  render(<ResearcherChatPanel />);
  const input = screen.getByPlaceholderText(/Ask about a simulation/i);
  fireEvent.change(input, { target: { value: "Run erosion sim" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

  expect(await screen.findByText("Run erosion sim")).toBeInTheDocument();
});

it("shows the assistant reply after a successful fetch", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ reply: "Erosion risk is High — 74%." }),
  });

  render(<ResearcherChatPanel />);
  const input = screen.getByPlaceholderText(/Ask about a simulation/i);
  fireEvent.change(input, { target: { value: "Run erosion sim" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

  await waitFor(() => {
    expect(screen.getByText("Erosion risk is High — 74%.")).toBeInTheDocument();
  });
});

it("clears the input after sending", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ reply: "Done." }),
  });

  render(<ResearcherChatPanel />);
  const input = screen.getByPlaceholderText(/Ask about a simulation/i) as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "Hello" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

  await waitFor(() => expect(input.value).toBe(""));
});

it("shows a network error message when fetch throws", async () => {
  mockFetch.mockRejectedValueOnce(new Error("Network failure"));

  render(<ResearcherChatPanel />);
  const input = screen.getByPlaceholderText(/Ask about a simulation/i);
  fireEvent.change(input, { target: { value: "Run contaminant sim" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

  await waitFor(() => {
    expect(screen.getByText(/Network error/i)).toBeInTheDocument();
  });
});

it("Shift+Enter does not send the message", () => {
  render(<ResearcherChatPanel />);
  const input = screen.getByPlaceholderText(/Ask about a simulation/i);
  fireEvent.change(input, { target: { value: "Hello" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

  expect(mockFetch).not.toHaveBeenCalled();
});

it("hides the suggested prompts once a message has been sent", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ reply: "Simulation complete." }),
  });

  render(<ResearcherChatPanel />);
  const input = screen.getByPlaceholderText(/Ask about a simulation/i);
  fireEvent.change(input, { target: { value: "Run erosion sim" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

  await waitFor(() => {
    expect(screen.queryByText("Ask me to run a simulation")).not.toBeInTheDocument();
  });
});

it("sends the full conversation history on follow-up messages", async () => {
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ reply: "First reply." }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ reply: "Second reply." }) });

  render(<ResearcherChatPanel />);
  const input = screen.getByPlaceholderText(/Ask about a simulation/i);

  // First message
  fireEvent.change(input, { target: { value: "First question" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
  await waitFor(() => screen.getByText("First reply."));

  // Second message
  fireEvent.change(input, { target: { value: "Follow-up" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
  await waitFor(() => screen.getByText("Second reply."));

  // Second call should include both prior turns in the body
  const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
  expect(secondCallBody.messages.length).toBeGreaterThanOrEqual(3); // user, assistant, user
});

it("shows the Shift+Enter hint in the input footer", () => {
  render(<ResearcherChatPanel />);
  expect(screen.getByText(/Shift\+Enter for new line/i)).toBeInTheDocument();
});
