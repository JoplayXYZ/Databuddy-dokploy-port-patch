import { runLifecycleCommand } from "../src/e2e-db-lifecycle";

try {
	const output = await runLifecycleCommand(process.argv.slice(2));
	console.log(output);
} catch (error) {
	console.error(
		`e2e-db-lifecycle: ${error instanceof Error ? error.message : String(error)}`
	);
	process.exit(1);
}
