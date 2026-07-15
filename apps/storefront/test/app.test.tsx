import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App.js";

describe("App", () => {
  it("renders the storefront heading", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /chaos monkey/i })).toBeDefined();
  });
});
