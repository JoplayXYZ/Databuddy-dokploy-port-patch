import { describe, expect, test } from "bun:test";
import { transform } from "./transform";

describe("transform", () => {
	const cases: Array<{
		changes: number;
		in: string;
		name: string;
		out: string;
	}> = [
		{
			name: "rybbit: event only",
			in: '<a data-rybbit-event="signup_clicked">Sign up</a>',
			out: '<a data-track="signup_clicked">Sign up</a>',
			changes: 1,
		},
		{
			name: "rybbit: event + prop",
			in: '<a data-rybbit-event="signup_clicked" data-rybbit-prop-source="hero">Sign up</a>',
			out: '<a data-track="signup_clicked" data-source="hero">Sign up</a>',
			changes: 2,
		},
		{
			name: "umami: event + prop (collision-prone prefix)",
			in: '<button data-umami-event="add_to_cart" data-umami-event-product="t-shirt" data-umami-event-price="29.99">Add</button>',
			out: '<button data-track="add_to_cart" data-product="t-shirt" data-price="29.99">Add</button>',
			changes: 3,
		},
		{
			name: "pirsch: event + meta + duration",
			in: '<a data-pirsch-event="checkout" data-pirsch-meta-plan="pro" data-pirsch-duration="123">Buy</a>',
			out: '<a data-track="checkout" data-plan="pro" data-duration="123">Buy</a>',
			changes: 3,
		},
		{
			name: "no-op: already on data-track",
			in: '<a data-track="signup_clicked">Sign up</a>',
			out: '<a data-track="signup_clicked">Sign up</a>',
			changes: 0,
		},
		{
			name: "no-op: unrelated data attrs preserved",
			in: '<a data-testid="cta" data-foo="bar">Hi</a>',
			out: '<a data-testid="cta" data-foo="bar">Hi</a>',
			changes: 0,
		},
		{
			name: "mixed dialects in same file",
			in: '<a data-rybbit-event="x"></a><a data-umami-event="y"></a><a data-pirsch-event="z"></a>',
			out: '<a data-track="x"></a><a data-track="y"></a><a data-track="z"></a>',
			changes: 3,
		},
		{
			name: "JSX with single quotes",
			in: "<button data-rybbit-event='start_free' data-rybbit-prop-placement='nav'>",
			out: "<button data-track='start_free' data-placement='nav'>",
			changes: 2,
		},
		{
			name: "umami: bare event vs event-suffixed prop are not confused",
			in: '<a data-umami-event="x" data-umami-event-foo="1">',
			out: '<a data-track="x" data-foo="1">',
			changes: 2,
		},
		{
			name: "pirsch: duration handled before generic meta",
			in: '<a data-pirsch-duration="500">',
			out: '<a data-duration="500">',
			changes: 1,
		},
	];

	test.each(cases)("$name", ({ in: input, out, changes }) => {
		const result = transform(input);
		expect(result.output).toBe(out);
		expect(result.changes).toBe(changes);
	});

	test("idempotent — running twice yields no further changes", () => {
		const input =
			'<a data-rybbit-event="x" data-rybbit-prop-y="1" data-umami-event="z">';
		const first = transform(input);
		const second = transform(first.output);
		expect(second.output).toBe(first.output);
		expect(second.changes).toBe(0);
	});
});
