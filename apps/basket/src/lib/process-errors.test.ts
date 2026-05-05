import { describe, expect, test, vi } from "vitest";

const { mockCaptureError, mockLogError } = vi.hoisted(() => ({
	mockCaptureError: vi.fn(),
	mockLogError: vi.fn(),
}));

vi.mock("@lib/tracing", () => ({
	captureError: mockCaptureError,
}));

vi.mock("evlog", () => ({
	log: {
		error: mockLogError,
	},
}));

const { handleUncaughtException, handleUnhandledRejection } = await import(
	"./process-errors"
);

describe("process error handlers", () => {
	test("uncaught exception logs and starts non-zero shutdown", () => {
		const shutdown = vi.fn(() => Promise.resolve());
		const error = new Error("boom");

		handleUncaughtException(error, shutdown);

		expect(mockCaptureError).toHaveBeenCalledWith(error);
		expect(mockLogError).toHaveBeenCalledWith(
			expect.objectContaining({
				process: "uncaughtException",
				error_message: "boom",
				error_source: "process",
			})
		);
		expect(shutdown).toHaveBeenCalledWith("uncaughtException", 1);
	});

	test("unhandled rejection logs without forcing process shutdown", () => {
		handleUnhandledRejection("bad promise");

		expect(mockCaptureError).toHaveBeenCalledWith("bad promise");
		expect(mockLogError).toHaveBeenCalledWith(
			expect.objectContaining({
				process: "unhandledRejection",
				error_message: "bad promise",
				error_source: "process",
			})
		);
	});
});

