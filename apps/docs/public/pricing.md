# Databuddy Pricing

Analytics, feature flags, and AI—usage-based events when you outgrow included volume.

[Website](https://www.databuddy.cc/pricing) · [This file](https://www.databuddy.cc/pricing.md) · [JSON API](https://www.databuddy.cc/api/pricing) · [Sign up](https://app.databuddy.cc/login). Same Markdown from **GET `/pricing`** with `Accept: text/markdown` (see `Vary: Accept`).

---

## Plans

| Plan | Price | Events / month (included) | Assistant messages / day | Event overage |
| --- | --- | --- | --- | --- |
| Free | $0/mo | 10,000 | 5 | — (upgrade to add volume) |
| Hobby | $10/mo | 30,000 | 10 | Tiered — see [Event overage](#event-overage-hobby--pro) |
| Pro | $50/mo | 1,000,000 | 75 | Tiered — see [Event overage](#event-overage-hobby--pro) |
| Enterprise | Custom | Custom | Custom | Custom |

---

## Event overage (Hobby & Pro)

Overage applies to **events beyond** your plan’s included monthly volume. Rates are **tiered by cumulative overage** (first band fills, then the next).

| Cumulative overage (events) | Price / event | Price / 1,000 events |
| --- | --- | --- |
| 1st – 2,000,000 | $0.000035 | $0.035 |
| 2,000,001 – 10,000,000 | $0.00003 | $0.03 |
| 10,000,001 – 50,000,000 | $0.00002 | $0.02 |
| 50,000,001 – 250,000,000 | $0.000015 | $0.015 |
| 250,000,001+ | $0.00001 | $0.01 |

Hobby and Pro use the **same** overage tiers; only the base price and included events differ.

---

## Examples (illustrative)

Monthly cost ≈ **plan price + overage** (USD).

- **Hobby**, 500,000 events: 470,000 overage, all in the first tier → ~$10 + (470,000 × $0.000035) ≈ **$26.45/mo**.
- **Pro**, 5,000,000 events: 4,000,000 overage → first 2,000,000 × $0.000035 + next 2,000,000 × $0.00003 = $70 + $60 → ~$50 + $130 = **$180/mo**.

---

## Product limits by plan

Limits below come from the product’s plan matrix (the **Enterprise** plan in checkout maps to **Scale**-tier limits in-app).

| | Free | Hobby | Pro | Enterprise |
| --- | --- | --- | --- | --- |
| Funnels | 1 | 5 | 50 | Unlimited |
| Goals | 2 | 10 | Unlimited | Unlimited |
| Feature flags | 3 | 10 | 100 | Unlimited |
| Team members | 2 | 5 | 25 | Unlimited |
| Target groups | — | 5 | 25 | Unlimited |
| Retention | — | ✓ | ✓ | ✓ |
| Error tracking | — | ✓ | ✓ | ✓ |
| AI Agent | — | — | ✓ | ✓ |

**AI capabilities:** Summarization and workspace Q&A are on all plans; **Global search** from Hobby; **Auto insights**, **anomaly detection**, and **SQL tooling** from Pro; **Correlation engine** on Scale / Enterprise.

---

## Enterprise

For custom volume, security reviews, SLAs, and onboarding, Databuddy offers **Enterprise** agreements.

Contact: use the options on [databuddy.cc/pricing](https://www.databuddy.cc/pricing) or your account team.

---

## Definitions

- **Event:** A tracked pageview or custom event ingested for analytics.
- **Assistant message:** One user message turn in the in-product AI assistant (daily limits reset per calendar day).
- **Overage:** Events in a billing month above the plan’s included monthly event allowance.
- **Enterprise vs Scale:** Billing may show “Enterprise”; in-product entitlements for that tier align with the **Scale** internal plan for feature limits.
