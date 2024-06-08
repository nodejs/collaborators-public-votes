#!/usr/bin/env node

import { exit } from "node:process";
import { argv, env } from "node:process";
import { fileURLToPath } from "node:url";

import count from "@node-core/caritat/countParticipationFromGit";
import countFromGit from "@node-core/caritat/countBallotsFromGit";
import { findVoteSubPath } from "./getVoteSubpath.mjs";

const shares = JSON.parse(argv[2])

const START_MARKER = "<!-- BEGIN PARTICIPATION -->";
const END_MARKER = "<!-- END PARTICIPATION -->";

let mdMessage = `\n\n${START_MARKER}\n\n`
let invalidCommitReason = ''

function* toArmoredMessage(str, chunkSize = 64) {
  yield "-----BEGIN PRIVATE KEY-----";
  for (let i = 0; i < str.length; i += chunkSize) {
    yield str.substr(i, chunkSize);
  }
  yield "-----END PRIVATE KEY-----";
}

const firstCommitRef = env.FIRST_COMMIT_REF;
const subPath = await findVoteSubPath(firstCommitRef);

if (shares.length === 1 && !shares[0].startsWith('-----BEGIN PGP MESSAGE-----')){
  // Open vote
  const { result, privateKey } = await countFromGit({
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    repoURL: env.REMOTE,
    branch: env.BRANCH,
    subPath,
    keyParts: shares,
    firstCommitRef,
    lastCommitRef: env.LAST_COMMIT_REF,
    pushToRemote: false,
    commitJsonSummary: null,
  });

  mdMessage += result.generateSummary(
      Array.from(
        toArmoredMessage(Buffer.from(privateKey).toString("base64"))
      ).join("\n")
    )
} else {
  const participationResult = await count({
    subPath,
    firstCommitRef: env.FIRST_COMMIT_REF,
    lastCommitRef: env.LAST_COMMIT_REF,
    reportInvalidCommitsAfter: env.CHECK_COMMITS_AFTER,
  });
  
  const participation = participationResult?.participation;
  
  if (participation == null) {
    console.error("Can't compute participation", participationResult);
    exit(1);
  }
   mdMessage += `Current estimated participation: ${
  Math.round(participation * 100_00) / 100
}%`;
invalidCommitReason = Object.entries(
  participationResult.invalidCommits ?? {}
)
  .map(
    ([sha, reason]) =>
      `Commit ${sha} won't be taken into account for the following reason: ${reason}`
  )
  .join("\n\n");
}


mdMessage += `\n\n${END_MARKER}\n`;

let body = env.PR_DESCRIPTION || "";
const startMarkerIndex = body.indexOf(START_MARKER);

if (startMarkerIndex === -1) {
  body += mdMessage;
} else {
  const endMarkerIndex = body.lastIndexOf(END_MARKER) + END_MARKER.length;
  body =
    body.slice(0, startMarkerIndex) +
    mdMessage +
    (endMarkerIndex > startMarkerIndex && endMarkerIndex < body.length
      ? body.slice(endMarkerIndex)
      : "");
}



console.log(
  JSON.stringify({
    body,
    hasFailures: Boolean(invalidCommitReason),
    invalidCommitReason,
  })
);
