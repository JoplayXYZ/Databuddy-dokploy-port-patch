import { describe, expect, it } from "bun:test";
import { decryptSlackToken, encryptSlackToken } from "./token-crypto";

describe("Slack token crypto", () => {
	it("round trips encrypted Slack bot tokens", () => {
		const ciphertext = encryptSlackToken("xoxb-secret", "local-secret");

		expect(ciphertext).not.toContain("xoxb-secret");
		expect(decryptSlackToken(ciphertext, "local-secret")).toBe("xoxb-secret");
	});
});
