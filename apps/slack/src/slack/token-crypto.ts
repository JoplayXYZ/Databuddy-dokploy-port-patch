import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;

export function encryptSlackToken(token: string, secret: string): string {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
	const ciphertext = Buffer.concat([
		cipher.update(token, "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return [VERSION, iv, tag, ciphertext]
		.map((part) =>
			typeof part === "string" ? part : part.toString("base64url")
		)
		.join(":");
}

export function decryptSlackToken(payload: string, secret: string): string {
	const [version, iv, tag, ciphertext] = payload.split(":");
	if (!(version === VERSION && iv && tag && ciphertext)) {
		throw new Error("Invalid Slack token ciphertext");
	}

	const decipher = createDecipheriv(
		"aes-256-gcm",
		keyFromSecret(secret),
		Buffer.from(iv, "base64url")
	);
	decipher.setAuthTag(Buffer.from(tag, "base64url"));
	return Buffer.concat([
		decipher.update(Buffer.from(ciphertext, "base64url")),
		decipher.final(),
	]).toString("utf8");
}

function keyFromSecret(secret: string): Buffer {
	return createHash("sha256").update(secret).digest();
}
