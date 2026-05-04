import { describe, expect, it } from "bun:test";
import { decryptSecret, encryptSecret } from "./token-crypto";

describe("Integration secret crypto", () => {
	it("round trips encrypted integration secrets", () => {
		const ciphertext = encryptSecret("xoxb-secret", "local-secret");

		expect(ciphertext).not.toContain("xoxb-secret");
		expect(decryptSecret(ciphertext, "local-secret")).toBe("xoxb-secret");
	});
});
