// The run's throwaway people, deleted from Gateweave ID and from courts, whatever the tests did. Found by their
// address prefix, so it also clears anything an earlier run left.
import { rmSync } from "node:fs";
import { test as teardown } from "@playwright/test";
import { inCourts, inId, LIKE, STATE } from "./target";

teardown("the throwaway people, deleted from Gateweave ID and from courts", () => {
	inId(`DELETE FROM user WHERE email LIKE ${LIKE}`);
	inId(`DELETE FROM deployment_invitation WHERE email LIKE ${LIKE}`);
	inCourts(`DELETE FROM user WHERE email LIKE ${LIKE}`);
	rmSync(STATE, { recursive: true, force: true });
});
