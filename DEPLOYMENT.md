# Deployment Runbook — vSnap Checklist Backend

> Shared context for any Claude session / operator. This is a **manual SSH deploy** to the
> vSnap production server. Read this before deploying so you don't rediscover the setup.
> Last verified: 2026-10-17.

## TL;DR deploy (copy/paste order)

Run locally first to update your working copy, then SSH into the server for the actual deploy.

```bash
# 1. Load the SSH key into the agent (key is passphrase-protected — you'll be prompted ONCE)
ssh-add ~/.ssh/vsnap_server

# 2. SSH in (user is always `administrator`)
ssh -i ~/.ssh/vsnap_server administrator@192.168.1.10
```

Then on the server (PowerShell — note: **old PowerShell, use `;` not `&&`**):

```powershell
cd C:\inetpub\wwwroot\botivate_new_api\vSnapChecklist_backend
git fetch origin main
git merge --ff-only origin/main      # fast-forward only; do NOT reset --hard
npm ci
npx prisma generate
npx prisma migrate deploy            # applies pending migrations to prod DB (botivatedb)
npm run build
Restart-Service BotivateAPI          # <-- this is how :4000 is restarted (see below)
```

Verify:

```powershell
Get-Service BotivateAPI | Format-List Name,Status
(Get-NetTCPConnection -LocalPort 4000 -State Listen | Measure-Object).Count   # expect 1
Invoke-WebRequest http://127.0.0.1:4000/ -UseBasicParsing                     # 404 on / is EXPECTED (no root route) = app is up
```

---

## Server facts

| Thing | Value |
|-------|-------|
| Host | `192.168.1.10` (reachable over the VPN) |
| SSH user | **`administrator`** — use this and nothing else |
| SSH key | `~/.ssh/vsnap_server` (public comment `claude-deploy`). **Passphrase-protected** |
| Shell | Windows PowerShell (old; `&&`/`||` not supported — use `;`) |
| Tooling | node v24, git 2.53, pm2 5.2, NSSM |
| Deploy path | `C:\inetpub\wwwroot\botivate_new_api\vSnapChecklist_backend` |
| App port | `4000` (behind IIS reverse proxy — see `deploy/web.config`) |
| Database | PostgreSQL `botivatedb`, schema `public`, `localhost:5432` |
| GitHub remote | `https://github.com/businessdevelopment-byte/vSnapChecklist_backend.git`, branch `main` |

### How the `:4000` process is managed  ← **IMPORTANT**

The backend runs as a **Windows service named `BotivateAPI`**, managed by **NSSM**
(`C:\Tools\NSSM\nssm.exe`), executing `node dist\index.js` from the deploy path, running as
`NT AUTHORITY\SYSTEM`. Control it **as `administrator`**:

```powershell
Restart-Service BotivateAPI      # restart after a deploy
Get-Service   BotivateAPI        # check status
nssm restart  BotivateAPI        # equivalent via NSSM
```

It is **NOT** managed by PM2. The server's PM2 service (`PM2_HOME=C:\ProgramData\pm2\home`,
running as a Windows service) manages only the **vsnapu.com web apps**
(`vsnapu-web-test` :4300, `vsnapu-web-prod` :4301), which deploy via their own GitHub Actions
self-hosted runner — unrelated to this backend.

## Automated deploy (GitHub webhook) — no GitHub Actions, no Cloudflare change

Pushes to `main` auto-deploy via a self-hosted webhook (free; no Actions minutes).

**Flow:** GitHub push → `https://botivateapi.vsnapu.com/__hooks__/<token>/deploy`
→ Cloudflare (existing record) → IIS rewrite rule → local listener `127.0.0.1:4055`
→ verifies HMAC → runs `deploy/auto-deploy.ps1` → restarts `BotivateAPI`.

**Pieces (all on the server):**
- `deploy/webhook-listener.mjs` — zero-dep Node listener. Runs as NSSM service
  **`VsnapDeployHook`** (SYSTEM, auto-start). Secret + port are in the service env
  (`WEBHOOK_SECRET`, `HOOK_PORT=4055`), **not** in git.
- `deploy/auto-deploy.ps1` — the deploy sequence (same as the manual one above),
  logging to `C:\Tools\vsnap-deploy\deploy.log`, with an overlap lock.
- IIS rewrite rule **"Deploy webhook"** in the site's root `web.config` (untracked;
  backups at `C:\Tools\vsnap-deploy\web.config.bak-*`), placed before the proxy rule.
- GitHub repo webhook: **Settings → Webhooks** → the URL above, content type
  `application/json`, the shared secret, **Just the push event**.

**Operate it:**
```powershell
Restart-Service VsnapDeployHook                       # after editing the listener code
Get-Content C:\Tools\vsnap-deploy\deploy.log -Tail 40 # last deploy output
Get-Content C:\Tools\vsnap-deploy\hook.log   -Tail 40 # listener / trigger log
```
The listener runs from the repo, so changes to `webhook-listener.mjs` take effect only
after `Restart-Service VsnapDeployHook`. The secret path token and HMAC secret are held
by the operator (not in the repo); rotate by updating the GitHub webhook, the service env,
and the `web.config` rule together.

**To pause auto-deploy:** `Stop-Service VsnapDeployHook` (or disable the GitHub webhook).

## Gotchas / do-not-repeat mistakes

- **SSH "Permission denied" even though the key is in `administrators_authorized_keys`:** the
  private key `~/.ssh/vsnap_server` is **passphrase-protected**. Non-interactive/`BatchMode`
  connections can't sign, so they fail *after* the server accepts the key. Fix: `ssh-add ~/.ssh/vsnap_server`
  once per login (type the passphrase), so the agent can sign for all later connections.
- The server's `administrators_authorized_keys` must be owned by and grant **only**
  `BUILTIN\Administrators` + `NT AUTHORITY\SYSTEM`. This is already set up correctly.
- **`scripts/deploy.sh` in this repo is inaccurate for this server** — it uses
  `pm2 startOrReload` and references a `.github/workflows/ci-cd.yml` that does not exist.
  Running it as-is would spawn a *second* instance under PM2 and collide on port 4000.
  Use `Restart-Service BotivateAPI` (above) instead, not that script.
- **Line-ending drift:** `git status` locally may show the whole tree as modified — that's pure
  CRLF↔LF noise (Windows↔macOS), not real changes. Confirm with
  `git diff --ignore-cr-at-eol --stat` (empty = drift only). Update with
  `git stash && git merge --ff-only origin/main` rather than `git reset --hard`.
- Deploys that include new `prisma/migrations/*` run `prisma migrate deploy`, which **alters the
  production database**. Confirm before applying.

## Last deploy (2026-10-17)

- Updated `aa0b0b3` → `1ef1dd1` (4 commits: auth/delegation/offboarding changes + 2 migrations).
- Migrations applied to `botivatedb`: `20261017053636_user_hard_delete_set_null`,
  `20261017063451_delegation_history_imported_at`.
- `BotivateAPI` restarted; `:4000` verified listening and responding.
