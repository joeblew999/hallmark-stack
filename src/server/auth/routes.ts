// Which of Better Auth's routes courts serves. Kept apart so CI's signed-out end-to-end tests (e2e/auth-routes.spec.ts)
// check the same lists that src/server/auth/config.ts uses.
//
// The rest answer any session, and a cookie may be stolen, so they are off, as Track v0.30.x turns off the ones it
// doesn't use (gateweavehq/track at ef2be25). Each was seen answering on staging, 2026-11-07. Accounts are Gateweave
// ID's, so nothing here changes one: courts takes the name and email from ID at every sign-in.

/** The routes courts uses: signing in through ID and out, the session, the health check, ID's logouts. */
export const USED_ROUTES = [
	"/sign-in/social",
	"/callback/oidc",
	"/sign-out",
	"/get-session",
	"/ok",
	"/backchannel-logout/oidc",
] as const;

/** Better Auth's other routes that answered, each turned off. */
export const DISABLED_ROUTES = [
	// Adds another way into the account, on a session alone: someone holding a stolen cookie could link their
	// own ID account and keep coming in after the session ends.
	"/link-social",
	"/unlink-account",
	"/list-accounts",
	// Hands over the tokens of someone's sessions.
	"/list-sessions",
	"/update-session",
	"/revoke-session",
	"/revoke-sessions",
	"/revoke-other-sessions",
	// Courts keeps none of ID's tokens, so these have nothing to give.
	"/get-access-token",
	"/refresh-token",
	"/account-info",
	// Name, email and the account itself are ID's.
	"/update-user",
	"/change-email",
	"/delete-user",
	// Courts has no passwords and sends no email (ID does both).
	"/sign-up/email",
	"/sign-in/email",
	"/change-password",
	"/verify-password",
	"/request-password-reset",
	"/reset-password",
	"/send-verification-email",
	"/verify-email",
] as const;
