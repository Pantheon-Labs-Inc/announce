// Pantheon announce: a GitHub Action with no dependencies. It reads the release that
// triggered the workflow and asks Pantheon for a launch kit, signed in with GitHub's OIDC token (no stored key) or a
// scoped API key. Drafts wait for approval in Pantheon unless the workspace allows low-risk releases to publish.
'use strict';

const fs = require('node:fs');

/** An input as GitHub passes it (INPUT_API-URL → INPUT_API_URL in some runners, so both are read). */
function input(name) {
  const key = `INPUT_${name.toUpperCase()}`;
  return (process.env[key] ?? process.env[key.replace(/-/g, '_')] ?? '').trim();
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value).replace(/\n/g, ' ')}\n`);
}

/** The release behind the run: the event payload, or the tag input. */
function release() {
  let event = {};
  try {
    event = process.env.GITHUB_EVENT_PATH ? JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
  } catch {
    event = {};
  }
  const tag = input('tag') || event.release?.tag_name || (process.env.GITHUB_REF?.startsWith('refs/tags/') ? process.env.GITHUB_REF.slice(10) : '');
  if (!tag) throw new Error('No release to announce: run on a release event or pass `tag`.');
  return {
    tag,
    title: event.release?.name || undefined,
    notes: input('notes') || event.release?.body || undefined,
    url: event.release?.html_url || undefined,
    repository: process.env.GITHUB_REPOSITORY,
  };
}

async function oidcToken(audience) {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const token = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !token) throw new Error('No OIDC token available. Add `permissions: id-token: write` to the job, or pass `api-key`.');
  const response = await fetch(`${url}&audience=${encodeURIComponent(audience)}`, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`GitHub refused an OIDC token (${response.status})`);
  return (await response.json()).value;
}

/** The Pantheon developer API; `api-url` only to point at another one (staging, self-hosted). */
const DEFAULT_API = 'https://api.usepantheon.app';

async function run(fetchImpl = fetch) {
  const api = (input('api-url') || DEFAULT_API).replace(/\/+$/, '');
  if (!/^https?:\/\//.test(api)) throw new Error('`api-url` must be an http(s) address, or left out for https://api.usepantheon.app');
  const rel = release();
  const apiKey = input('api-key');
  let response;
  if (apiKey) {
    response = await fetchImpl(`${api}/v1/launch-kits`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'user-agent': 'pantheon-announce' },
      body: JSON.stringify({ repository: rel.repository, tag: rel.tag, title: rel.title, notes: rel.notes, url: rel.url }),
    });
  } else {
    const token = await oidcToken(input('audience') || 'pantheon');
    response = await fetchImpl(`${api}/v1/integrations/github/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'user-agent': 'pantheon-announce' },
      body: JSON.stringify({ tag: rel.tag, title: rel.title, notes: rel.notes, url: rel.url }),
    });
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Pantheon answered ${response.status}`);
  const posts = typeof body.posts === 'number' ? body.posts : (body.postIds?.length ?? 0);
  setOutput('launch-kit-id', body.id ?? '');
  setOutput('posts', posts);
  setOutput('status', body.status ?? 'unknown');
  const summary = body.status === 'skipped' ? `Pantheon decided ${rel.tag} isn't worth announcing.` : `Pantheon drafted ${posts} post(s) for ${rel.tag}; review them in Pantheon.`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Pantheon\n\n${summary}\n`);
  return body;
}

module.exports = { run, release, input };

if (require.main === module) {
  run().catch((error) => {
    console.log(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
