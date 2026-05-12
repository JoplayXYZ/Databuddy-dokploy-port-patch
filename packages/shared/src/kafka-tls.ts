export function resolveKafkaSsl(
	hasCredentials: boolean,
	env: NodeJS.ProcessEnv = process.env
): boolean {
	const explicit = env.REDPANDA_SSL?.toLowerCase();
	if (explicit === "true") {
		return true;
	}
	if (explicit === "false") {
		if (
			hasCredentials &&
			env.NODE_ENV === "production" &&
			env.ALLOW_INSECURE_KAFKA?.toLowerCase() !== "true"
		) {
			throw new Error(
				"Refusing to use SASL without TLS in production. Set REDPANDA_SSL=true or ALLOW_INSECURE_KAFKA=true to override."
			);
		}
		return false;
	}

	if (env.NODE_ENV === "production") {
		return true;
	}
	return false;
}
