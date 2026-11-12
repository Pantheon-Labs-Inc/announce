# Pantheon announce

Turns a GitHub release into a launch kit: an X thread, a LinkedIn post, Threads and Bluesky posts, a dev.to article,
a changelog entry and an email snippet, written in your brand voice from the release notes and the pull requests
that shipped. The drafts wait for approval in Pantheon (approve them from your phone), unless your workspace lets
low-risk releases publish on their own.

## With GitHub's OIDC token (no stored key)

Connect the repository in Pantheon (Integrations → GitHub) and turn it on, then:

```yaml
on:
  release:
    types: [published]

jobs:
  announce:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - uses: Pantheon-Labs-Inc/announce@v1
```

## With an API key

Create a key in Pantheon (Settings → API keys) with `post:create`, store it as the `PANTHEON_API_KEY` secret, then:

```yaml
      - uses: Pantheon-Labs-Inc/announce@v1
        with:
          api-key: ${{ secrets.PANTHEON_API_KEY }}
```

Both need a plan with the CLI and GitHub Action (Pro and up). The Action talks to the Pantheon API at
`https://api.usepantheon.app`; pass `api-url` only to use another one (a staging or self-hosted Pantheon).

## Inputs

| Input | Meaning |
| --- | --- |
| `api-key` | A Pantheon API key with `post:create`, from a secret. Leave it out to sign in with GitHub's OIDC token. |
| `tag` | The release to announce. Defaults to the release that triggered the workflow. |
| `notes` | Release notes to draft from when the release has none on GitHub. |
| `api-url` | Only to use another Pantheon API than `https://api.usepantheon.app`. |
| `audience` | The OIDC audience Pantheon expects (default `pantheon`). |

## Versions

`@v1` follows the latest 1.x release, so you get fixes without changing your workflow. Pin an exact release
(`@v1.2.0`) or a commit SHA if you'd rather update on your own schedule.

## Outputs

| Output | Meaning |
| --- | --- |
| `launch-kit-id` | The launch kit Pantheon created |
| `posts` | How many drafts are waiting for approval |
| `status` | `ready`, `skipped` (not worth announcing) or `failed` |

## License

[Apache-2.0](LICENSE). Copyright 2026 Pantheon LLC.

This repository is published automatically from Pantheon's main codebase; changes made here directly are
overwritten by the next release.
