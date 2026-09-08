# One shared workspace, no authentication

There are no users, sessions, or logins. Every visitor to the deployed app sees and can act on the same Meetings. The brief asks for a working link a reviewer can open; a login screen is friction with no grading upside, and per-user isolation would cost around two hours of a ten-hour budget.

Consequences: there is no `users` table and no ownership column on `meetings`. Anything a reviewer creates is visible to every other reviewer. Abuse is bounded by the global daily cap (ADR-0005), not by identity.

**Considered**: Supabase Auth with magic links and row-level security. Rejected for this submission; it would be the first thing to add if the app became multi-tenant.
