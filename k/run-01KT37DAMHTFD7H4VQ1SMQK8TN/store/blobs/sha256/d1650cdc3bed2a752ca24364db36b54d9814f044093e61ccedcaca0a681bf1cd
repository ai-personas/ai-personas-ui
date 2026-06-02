# Token-Bucket vs Leaky-Bucket Rate Limiting

Token-bucket and leaky-bucket rate limiters both control request flow, but they optimize for different traffic shapes. Token-bucket allows controlled bursts while enforcing an average rate. Leaky-bucket smooths output into a steadier stream and is stricter about bursts.

| Aspect | Token Bucket | Leaky Bucket |
|---|---|---|
| Core model | Tokens accumulate at a fixed rate up to a capacity. A request spends tokens. | Requests enter a queue and drain at a fixed rate. Overflow is rejected or delayed. |
| Burst handling | Allows bursts up to available token capacity. | Suppresses bursts by draining steadily. |
| Typical use | API limits where short bursts are acceptable. | Traffic shaping where consistent output rate matters. |
| Failure mode | Requests are rejected or delayed when tokens are exhausted. | Requests are rejected or delayed when the bucket or queue is full. |
| Main tuning knobs | Refill rate and bucket capacity. | Drain rate and queue/bucket depth. |

## Practical Selection

Use token-bucket when clients need occasional bursts without exceeding a long-term average. Use leaky-bucket when downstream systems need a stable, predictable arrival rate. In practice, token-bucket is often preferred for API rate limiting, while leaky-bucket is common for smoothing network or processing pipelines.
