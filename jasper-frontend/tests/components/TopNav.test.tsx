import { render, screen, fireEvent } from "@testing-library/react";
import { TopNav } from "../../app/components/Layout/TopNav";

// Mock ThemeToggle and icon components to avoid SVG/DOM issues
jest.mock("../../app/components/Controls/ThemeToggle", () => ({
  ThemeToggle: () => <button aria-label="Toggle theme">Theme</button>,
}));
jest.mock("../../app/components/Layout/icons", () => ({
  BellIcon:     () => <span />,
  MenuIcon:     () => <span />,
  SettingsIcon: () => <span />,
}));

const MOCK_USER = { id: "u1", name: "Edwin Park", email: "edwin@jasper.ca", role: "admin" as const, createdAt: "2024-06-01" };

it("renders without crashing", () => {
  render(<TopNav activeTab="map" onTabChange={() => {}} onOpenLogs={() => {}} hasUnread={false} onToggleSidebar={() => {}} currentUser={MOCK_USER} onLogout={() => {}} />);
});

it("shows the Jasper Environmental Twin branding", () => {
  render(<TopNav activeTab="map" onTabChange={() => {}} onOpenLogs={() => {}} hasUnread={false} onToggleSidebar={() => {}} currentUser={MOCK_USER} onLogout={() => {}} />);
  expect(screen.getByText("Jasper Environmental Twin")).toBeInTheDocument();
});

it("highlights the active Map View tab", () => {
  render(<TopNav activeTab="map" onTabChange={() => {}} onOpenLogs={() => {}} hasUnread={false} onToggleSidebar={() => {}} currentUser={MOCK_USER} onLogout={() => {}} />);
  const mapTab = screen.getByText("Map View");
  expect(mapTab.className).toContain("cyan");
});

it("calls onTabChange when a tab is clicked", () => {
  const mock = jest.fn();
  render(<TopNav activeTab="map" onTabChange={mock} onOpenLogs={() => {}} hasUnread={false} onToggleSidebar={() => {}} currentUser={MOCK_USER} onLogout={() => {}} />);
  fireEvent.click(screen.getByText("Dashboard"));
  expect(mock).toHaveBeenCalledWith("dashboard");
});

it("shows sign-out link", () => {
  render(<TopNav activeTab="map" onTabChange={() => {}} onOpenLogs={() => {}} hasUnread={false} onToggleSidebar={() => {}} currentUser={MOCK_USER} onLogout={() => {}} />);
  expect(screen.getByText("Sign out")).toBeInTheDocument();
});

it("shows User Management tab for superadmin role", () => {
  const superadmin = { ...MOCK_USER, role: "superadmin" as const };
  render(<TopNav activeTab="map" onTabChange={() => {}} onOpenLogs={() => {}} hasUnread={false} onToggleSidebar={() => {}} currentUser={superadmin} onLogout={() => {}} />);
  expect(screen.getByText("User Management")).toBeInTheDocument();
});

it("does NOT show User Management tab for admin role", () => {
  render(<TopNav activeTab="map" onTabChange={() => {}} onOpenLogs={() => {}} hasUnread={false} onToggleSidebar={() => {}} currentUser={MOCK_USER} onLogout={() => {}} />);
  expect(screen.queryByText("User Management")).not.toBeInTheDocument();
});

it("calls onLogout when Sign out is clicked", () => {
  const mock = jest.fn();
  render(<TopNav activeTab="map" onTabChange={() => {}} onOpenLogs={() => {}} hasUnread={false} onToggleSidebar={() => {}} currentUser={MOCK_USER} onLogout={mock} />);
  fireEvent.click(screen.getByText("Sign out"));
  expect(mock).toHaveBeenCalled();
});
