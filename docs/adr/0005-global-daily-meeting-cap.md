# A global daily cap on Meeting creation is the only abuse guard

The app is public, has no login (ADR-0003), and every new Meeting costs real money in Claude Opus 5 calls. Per-IP rate limiting was considered and dropped for scope. Instead, creating a Meeting is refused with a friendly message once `MAX_MEETINGS_PER_DAY` (default 50) Meetings have been created in the trailing 24 hours. Sample Meetings are excluded from the count.

This bounds worst-case daily spend to a few dollars with one SQL count and no extra infrastructure. It does not stop one person from consuming the whole allowance, which is acceptable for a demo whose reviewers are a handful of people.

**Considered**: per-IP limits plus the global cap (more code, and IPs behind Cloudflare need header handling), and a spend limit in the Anthropic console alone (zero code, but the app fails opaquely when hit).
