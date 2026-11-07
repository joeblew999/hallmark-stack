// From Gateweave Track (github.com/gateweavehq/track) at b8b5ba0: apps/web/src/components/live-button.tsx, on this
// site's own `.btn` instead of shadcn's Button.
import { useHydrated } from "@tanstack/react-router";
import type { ComponentProps } from "react";

/**
 * A button that works only through the page's script, and so stays disabled until there is one. In
 * a form this matters more than it looks: pressed before the script has run, a submit button makes
 * the browser send the form itself, as a GET, with the password in the URL. Disabling the button
 * stops that, Enter included. Outside a form, an early press would do nothing and say nothing.
 */
export function LiveButton({ disabled, className, ...props }: ComponentProps<"button">) {
	const hydrated = useHydrated();
	return (
		<button
			type="button"
			className={className ?? "btn"}
			{...props}
			disabled={disabled || !hydrated}
		/>
	);
}
