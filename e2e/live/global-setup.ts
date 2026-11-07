// Before the live suite: this repo's Cloudflare login (it says who, or asks once), and Gateweave ID's pinned release,
// whose own Wrangler reaches ID's D1.
import { execFileSync } from "node:child_process";
import { fetchId } from "../../scripts/id-release.mjs";

export default function globalSetup() {
	execFileSync("node", ["scripts/cloudflare-login.mjs"], { stdio: "inherit" });
	fetchId();
}
