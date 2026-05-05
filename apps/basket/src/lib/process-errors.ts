import { captureError } from "@lib/tracing";
import { log } from "evlog";

type ShutdownHandler = (
	signal: string,
	exitCode: number
) => Promise<void> | void;

function describeError(error: unknown): {
	message: string;
	stack?: string;
} {
	if (error instanceof Error) {
		return { message: error.message, stack: error.stack };
	}

	return { message: String(error) };
}

function logProcessError(processName: string, error: unknown): void {
	const { message, stack } = describeError(error);

	captureError(error);
	log.error({
		process: processName,
		error_message: message,
		error_stack: stack,
		error_source: "process",
	});
}

export function handleUnhandledRejection(reason: unknown): void {
	logProcessError("unhandledRejection", reason);
}

export function handleUncaughtException(
	error: unknown,
	shutdown: ShutdownHandler
): void {
	logProcessError("uncaughtException", error);

	try {
		const result = shutdown("uncaughtException", 1);
		if (result && typeof result.then === "function") {
			result.catch((shutdownError) => {
				const { message } = describeError(shutdownError);
				log.error({
					process: "uncaughtException",
					error_message: message,
					error_source: "shutdown",
				});
			});
		}
	} catch (shutdownError) {
		const { message } = describeError(shutdownError);
		log.error({
			process: "uncaughtException",
			error_message: message,
			error_source: "shutdown",
		});
	}
}
