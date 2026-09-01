// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionError } from "./ConnectionError";
import { UnsupportedBrowser } from "./UnsupportedBrowser";

afterEach(cleanup);

describe("UnsupportedBrowser", () => {
  it("shows a clear unsupported notice without mocking any success", () => {
    render(<UnsupportedBrowser />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/WebMCP/i);
    expect(alert.textContent).toMatch(/disabled/i);
    expect(alert.textContent).toMatch(/no tool call is mocked or substituted/i);
    expect(screen.queryByText(/transfer complete/i)).toBeNull();
  });

  it("keeps the sample states readable for inspection", () => {
    render(<UnsupportedBrowser />);
    expect(screen.getByRole("alert").textContent).toMatch(/sample provider states/i);
  });
});

describe("ConnectionError", () => {
  it("names the affected origin and offers a retry action", async () => {
    const onRetry = vi.fn();
    render(
      <ConnectionError
        title="Gather source provider not connected"
        origin="http://localhost:4174"
        state="disconnected"
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("http://localhost:4174");
    expect(screen.getByRole("alert").textContent).toMatch(/disconnected/i);
    await userEvent.click(screen.getByRole("button", { name: "Retry discovery" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders without a retry control when none is provided", () => {
    render(
      <ConnectionError title="Origin configuration error" message="Exact Gather origin required" />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Exact Gather origin required");
    expect(screen.queryByRole("button", { name: "Retry discovery" })).toBeNull();
  });
});
