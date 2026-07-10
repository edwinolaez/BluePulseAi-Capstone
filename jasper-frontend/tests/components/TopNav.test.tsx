import { render, screen, fireEvent } from "@testing-library/react";
import { TopNav } from "../../app/components/Layout/TopNav";

jest.mock("../../app/components/Controls/ThemeToggle", () => ({
  ThemeToggle: () => <button aria-label="Toggle theme">Theme</button>,
}));
jest.mock("../../app/components/Layout/icons", () => ({
  BellIcon:     () => <span />,
  MenuIcon:     () => <span />,
  SettingsIcon: () => <span />,
}));

const MOCK_USER = { id: "u1", name: "Edwin Park", email: "edwin@jasper.ca", role: "admin" as const, createdAt: "2024-06-01" };

const BASE_PROPS = {
  activeTab: "map" as const,
  onTabChange: () => {},
  onOpenLogs: () => {},
  hasUnread: false,
  onToggleSidebar: () => {},
  onOpenSupport: () => {},
  currentUser: MOCK_USER,
  onLogout: () => {},
};

it("renders without crashing", () => {
  render(<TopNav {...BASE_PROPS} />);
});

it("shows the Jasper Environmental Twin branding", () => {
  render(<TopNav {...BASE_PROPS} />);
  expect(screen.getByText("Jasper Environmental Twin")).toBeInTheDocument();
});

it("highlights the active Map View tab", () => {
  render(<TopNav {...BASE_PROPS} />);
  const mapTab = screen.getByText("Map View");
  expect(mapTab.className).toContain("cyan");
});

it("calls onTabChange when a tab is clicked", () => {
  const mock = jest.fn();
  render(<TopNav {...BASE_PROPS} onTabChange={mock} />);
  fireEvent.click(screen.getByText("Dashboard"));
  expect(mock).toHaveBeenCalledWith("dashboard");
});

it("shows sign-out link after opening the profile dropdown", () => {
  render(<TopNav {...BASE_PROPS} />);
  // The avatar button (first name + role badge) opens the dropdown
  fireEvent.click(screen.getByRole("button", { name: /Edwin/i }));
  expect(screen.getByText("Sign out")).toBeInTheDocument();
});

it("shows User Management tab for superadmin role", () => {
  const superadmin = { ...MOCK_USER, role: "superadmin" as const };
  render(<TopNav {...BASE_PROPS} currentUser={superadmin} />);
  expect(screen.getByText("User Management")).toBeInTheDocument();
});

it("does NOT show User Management tab for admin role", () => {
  render(<TopNav {...BASE_PROPS} />);
  expect(screen.queryByText("User Management")).not.toBeInTheDocument();
});

it("calls onLogout when Sign out is clicked", () => {
  const mock = jest.fn();
  render(<TopNav {...BASE_PROPS} onLogout={mock} />);
  // Open the dropdown first, then click Sign out
  fireEvent.click(screen.getByRole("button", { name: /Edwin/i }));
  fireEvent.click(screen.getByText("Sign out"));
  expect(mock).toHaveBeenCalled();
});
