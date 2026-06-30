import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginPage } from "../../app/components/Auth/LoginPage";

// Mock AuthContext so LoginPage can call useAuth()
jest.mock("../../app/contexts/AuthContext", () => ({
  useAuth: () => ({
    login: jest.fn().mockReturnValue({ ok: false, error: "Incorrect email or password." }),
  }),
}));

it("renders the sign-in form", () => {
  render(<LoginPage onLoginSuccess={() => {}} onSuperadminPending={() => {}} />);
  expect(screen.getByText("Sign In")).toBeInTheDocument();
});

it("renders the branding title", () => {
  render(<LoginPage onLoginSuccess={() => {}} onSuperadminPending={() => {}} />);
  expect(screen.getByText("Jasper Environmental Twin")).toBeInTheDocument();
});

it("renders email and password inputs", () => {
  render(<LoginPage onLoginSuccess={() => {}} onSuperadminPending={() => {}} />);
  expect(screen.getByPlaceholderText("you@jasper.ca")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
});

it("shows an error when submitting empty fields", async () => {
  render(<LoginPage onLoginSuccess={() => {}} onSuperadminPending={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));
  await waitFor(() => {
    expect(screen.getByText(/Please enter your email and password/i)).toBeInTheDocument();
  });
});

it("shows the demo credentials hint section", () => {
  render(<LoginPage onLoginSuccess={() => {}} onSuperadminPending={() => {}} />);
  expect(screen.getByText(/Demo credentials/i)).toBeInTheDocument();
});
