// Hallmark's verdict on one sloplint run, for both suites (e2e/hallmark.spec.ts signed out, e2e/live/flows.spec.ts
// signed in): clean is sloplint's own, exit 0 with nothing open, no FAIL, REFLEX or WARN in its summary line. A finding
// dismissed or waived on the record in the stamp (src/styles.css) reports as DISMISSED or WAIVED, which is clean.
export function hallmarkClean(output: string): boolean {
	const summary = output.split("\n").find((line) => line.trim().startsWith("sloplint:")) ?? "";
	return (
		summary !== "" &&
		!/\b[1-9]\d* (FAIL|REFLEX|WARN)\b/.test(summary) &&
		output.trimEnd().endsWith("(sloplint exited 0)")
	);
}
