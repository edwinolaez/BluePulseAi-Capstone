import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminPage } from "../../app/components/Pages/AdminPage";

// Stub icons so SVG markup doesn't interfere with the DOM queries
jest.mock("../../app/components/Layout/icons", () => ({
  TrashIcon:    () => <span data-testid="trash-icon" />,
  DownloadIcon: () => <span data-testid="download-icon" />,
}));

// Provide a controlled useAuth() so the tests are independent of localStorage
const mockAddUser    = jest.fn();
const mockRemoveUser = jest.fn();

jest.mock("../../app/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { id: "u1", name: "Dr. Eleanor Vance", email: "eleanor@jasper.ca", role: "researcher", createdAt: "2024-06-01" },
    users: [
      { id: "u1", name: "Dr. Eleanor Vance",   email: "eleanor@jasper.ca", role: "researcher", createdAt: "2024-06-01" },
      { id: "u2", name: "Edwin Park",           email: "edwin@jasper.ca",   role: "admin",      createdAt: "2024-06-01" },
    ],
    addUser:    mockAddUser,
    removeUser: mockRemoveUser,
  }),
}));

it("renders the User Management heading", () => {
  render(<AdminPage />);
  expect(screen.getByText("User Management")).toBeInTheDocument();
});

it("shows the page description", () => {
  render(<AdminPage />);
  expect(screen.getByText(/Only visible to super administrators/i)).toBeInTheDocument();
});

it("shows the total account count in the list header", () => {
  render(<AdminPage />);
  expect(screen.getByText(/2 total/i)).toBeInTheDocument();
});

it("renders each user's name", () => {
  render(<AdminPage />);
  expect(screen.getByText("Dr. Eleanor Vance")).toBeInTheDocument();
  expect(screen.getByText("Edwin Park")).toBeInTheDocument();
});

it("marks the current user with a '(you)' label", () => {
  render(<AdminPage />);
  expect(screen.getByText("(you)")).toBeInTheDocument();
});

it("renders a Remove button only for other users, not the current user", () => {
  render(<AdminPage />);
  // Only Edwin Park gets a Remove button (Eleanor is the current user)
  const removeButtons = screen.getAllByRole("button", { name: /Remove/i });
  expect(removeButtons).toHaveLength(1);
});

it("shows the Add New Account section", () => {
  render(<AdminPage />);
  expect(screen.getByText("Add New Account")).toBeInTheDocument();
});

it("shows form inputs for name, email, and password", () => {
  render(<AdminPage />);
  expect(screen.getByPlaceholderText("Dr. Jane Smith")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("jane@jasper.ca")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Min. 8 characters")).toBeInTheDocument();
});

it("shows a role dropdown", () => {
  render(<AdminPage />);
  expect(screen.getByRole("combobox")).toBeInTheDocument();
});

it("shows a validation error when form is submitted with empty fields", async () => {
  render(<AdminPage />);
  fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));
  await waitFor(() => {
    expect(screen.getByText(/All fields are required/i)).toBeInTheDocument();
  });
});

it("shows a validation error when password is too short", async () => {
  render(<AdminPage />);
  fireEvent.change(screen.getByPlaceholderText("Dr. Jane Smith"),     { target: { value: "Test User" } });
  fireEvent.change(screen.getByPlaceholderText("jane@jasper.ca"),     { target: { value: "test@jasper.ca" } });
  fireEvent.change(screen.getByPlaceholderText("Min. 8 characters"),  { target: { value: "short" } });
  fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));
  await waitFor(() => {
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });
});

it("calls addUser when the form is filled out correctly", async () => {
  mockAddUser.mockReturnValue({ ok: true });
  render(<AdminPage />);
  fireEvent.change(screen.getByPlaceholderText("Dr. Jane Smith"),     { target: { value: "Test User" } });
  fireEvent.change(screen.getByPlaceholderText("jane@jasper.ca"),     { target: { value: "test@jasper.ca" } });
  fireEvent.change(screen.getByPlaceholderText("Min. 8 characters"),  { target: { value: "Password1" } });
  fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));
  await waitFor(() => {
    expect(mockAddUser).toHaveBeenCalledWith(expect.objectContaining({
      name: "Test User",
      email: "test@jasper.ca",
    }));
  });
});
