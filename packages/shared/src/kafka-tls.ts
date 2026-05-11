/**
 * Resolves whether Kafka/Redpanda SASL connections should use TLS.
 *
 * - Production defaults to `ssl: true`, unless `REDPANDA_SSL=false` is set
 *   explicitly (e.g. for local broker via Tailscale).
 * - Non-production defaults to `ssl: false`.
 * - Refuses SASL without TLS in production unless `ALLOW_INSECURE_KAFKA=true`
 *   is set explicitly.
 *
 * SCRAM authenticates but does not encrypt: username, topic metadata, and
 * payloads ride in cleartext on the unencrypted socket. Pair SASL with TLS
 * unless the broker is reachable only over a trusted transport (mTLS mesh,
 * VPC-private, etc.).
 */
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
