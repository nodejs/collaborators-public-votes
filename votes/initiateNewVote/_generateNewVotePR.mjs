import { once } from "node:events";
import { spawn } from "node:child_process";
import { exit } from "node:process";
import { Buffer } from "node:buffer";

export const keyServerURL = "hkps://keys.openpgp.org";

export function secretHolderThreshold(argv) {
  if (!argv['secret-holder']?.length) return 1
  if ('secret-holder-threshold' in argv) return Math.min(argv['secret-holder-threshold'], argv['secret-holder'].length)

  return Math.max(argv['secret-holder'].length, Math.min(3, Math.floor(2 * Math.log2(argv['secret-holder'].length))))
}

export const prOptions = {
  ["github-repo-name"]: {
    type: "string",
    describe: "GitHub repository, in the format owner/repo",
  },
  "pr-intro": {
    type: "string",
    describe: "Add an intro in markdown format for the PR body",
  },
  branch: {
    type: "string",
    short: "b",
    describe: "Name of the branch and subdirectory to use for the tests",
    demandOption: true,
  },
  subject: {
    type: "string",
    short: "s",
  },
  "secret-holder-threshold": {
    type: "string",
  },
  "secret-holder": {
    type: "string",
    multiple: true,
  },
}

export async function createVotePR(argv) {
  const cp = spawn(
    "gh",
    [
      "api",
      `repos/${argv["github-repo-name"]}/pulls`,
      "-F",
      "base=main",
      "-F",
      `head=${argv.branch}`,
      "-F",
      `title=${argv.subject}`,
      "-F",
      `body=${argv["pr-intro"] ?? ""},

To close the vote, a minimum of ${secretHolderThreshold(argv)} key parts would need to be revealed.

Vote instructions will follow.`,
      "--jq",
      ".html_url",
    ],
    { stdio: ["inherit", "pipe", "inherit"] }
  );
  // @ts-ignore toArray does exist!
  const out = cp.stdout.toArray();
  const [code] = await once(cp, "exit");
  if (code !== 0) exit(code);

  const prUrl = Buffer.concat(await out)
    .toString()
    .trim();

  {
    const cp = spawn(
      "gh",
      [
        "pr",
        "edit",
        prUrl,
        "--body",
        `${argv["pr-intro"] ?? ""}

Vote instructions:

- on the web: <https://nodejs.github.io/caritat/#${prUrl}>
- on the CLI:
  ${"```sh"}
  git node vote ${prUrl}
  ${"```"}

${argv['secret-holder']?.length ?
`To close the vote, at least ${secretHolderThreshold(argv)} secret holder(s)[^1] must \
run the following command: ${"`"}git node vote ${prUrl} --decrypt-key-part --post-comment${"`"}
` : ''}
        `,
      ],
      { stdio: "inherit" },
    );

    const [code] = await once(cp, "exit");
    if (code !== 0) exit(code);
  }

  console.log("PR created", prUrl);
}
