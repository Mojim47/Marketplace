#!/usr/bin/env node

import process from 'node:process';

function required(name, fallback = '') {
  return process.env[name] || fallback;
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`webhook ${url} failed (${res.status}): ${text.slice(0, 400)}`);
  }
}

function buildIncident() {
  const server = required('GITHUB_SERVER_URL', 'https://github.com');
  const repo = required('GITHUB_REPOSITORY');
  const runId = required('GITHUB_RUN_ID');
  const sha = required('GITHUB_SHA');
  const ref = required('GITHUB_REF');
  const actor = required('GITHUB_ACTOR');
  const workflow = required('GITHUB_WORKFLOW');
  const job = required('GITHUB_JOB');
  const gate = required('GATE_NAME', 'unknown-gate');
  const env = required('DEPLOY_ENV', 'unknown');
  const runUrl = repo && runId ? `${server}/${repo}/actions/runs/${runId}` : '';
  const shortSha = sha ? sha.slice(0, 12) : 'unknown';

  return {
    gate,
    env,
    workflow,
    job,
    repo,
    runId,
    runUrl,
    sha,
    shortSha,
    ref,
    actor,
  };
}

async function main() {
  const slackWebhook = required('SLACK_WEBHOOK_URL');
  const teamsWebhook = required('TEAMS_WEBHOOK_URL');

  if (!slackWebhook && !teamsWebhook) {
    console.log(
      'gate-failure-notify skipped (no SLACK_WEBHOOK_URL/TEAMS_WEBHOOK_URL configured)'
    );
    return;
  }

  const incident = buildIncident();
  const title = `Gate Failure: ${incident.gate}`;
  const text = [
    `repo=${incident.repo}`,
    `env=${incident.env}`,
    `workflow=${incident.workflow}`,
    `job=${incident.job}`,
    `sha=${incident.shortSha}`,
    `ref=${incident.ref}`,
    `actor=${incident.actor}`,
    `run=${incident.runUrl}`,
  ].join('\n');

  const tasks = [];
  if (slackWebhook) {
    tasks.push(
      postJson(slackWebhook, {
        text: `:rotating_light: ${title}\n${text}`,
      })
    );
  }
  if (teamsWebhook) {
    tasks.push(
      postJson(teamsWebhook, {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        themeColor: 'E81123',
        summary: title,
        title,
        text: text.replace(/\n/g, '<br/>'),
      })
    );
  }

  await Promise.all(tasks);
  console.log(
    JSON.stringify(
      {
        status: 'ok',
        notified: {
          slack: Boolean(slackWebhook),
          teams: Boolean(teamsWebhook),
        },
        incident,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`gate-failure-notify FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
