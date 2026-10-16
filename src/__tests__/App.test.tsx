import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import App from "@/App";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );

describe("Pulse shell", () => {
  beforeEach(() => i18n.changeLanguage("en"));

  it("shows the shared header with Pulse as the current project", async () => {
    renderAt("/");
    expect(screen.getByTestId("header-title")).toHaveTextContent("Pulse");
    await userEvent.click(screen.getByRole("button", { name: "Switch project" }));
    expect(screen.getByRole("menuitem", { name: "Pulse" })).toHaveAttribute("aria-current", "page");
  });

  it("navigates between the four sections from the shared tab bar", async () => {
    renderAt("/");
    const tabs = screen.getByRole("navigation", { name: "Pulse pages" });
    expect(
      within(tabs)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["Overview", "Team Pulse", "Retrospectives", "Actions"]);
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    for (const name of ["Team Pulse", "Retrospectives", "Actions"]) {
      await userEvent.click(within(tabs).getByRole("link", { name }));
      expect(within(tabs).getByRole("link", { name })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("heading", { level: 1, name })).toBeInTheDocument();
      expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    }
  });

  it("sends unknown routes to the overview", () => {
    renderAt("/missing");
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
  });
});
