# Re-pulls the BYU calendar, gates it, and commits -- run by a Windows scheduled task every
# other day. See docs/DECISIONS.md section 26.
#
# WHY THIS IS NOT A GITHUB ACTION
# -------------------------------
# It was, and it never worked. calendar.byu.edu sits behind CloudFront, which 403s GitHub's
# runner IP ranges: a dispatched run on 11 Nov got "0 rows from 0 windows" across all 39
# requests and wrote a 2-event snapshot. A home connection pulls the same URLs fine. The fetch
# therefore has to run from a machine BYU will answer, which means this one.
#
# SAFETY
# ------
# fetch-events.mjs skips a window it cannot read and carries on, so a blocked or flaky run
# produces a technically valid but gutted snapshot. Nothing in the fetch itself catches that.
# The gate here is `npm run smoke`, whose filter checks fail when the real events go missing --
# that is exactly how the gutted CI snapshot was caught. If any gate fails, the snapshot is
# restored from git and nothing is committed, so a bad pull cannot sit in the working tree
# waiting to be picked up by the next manual commit.

$ErrorActionPreference = 'Continue'  # npm writes warnings to stderr; let exit codes decide

$repo = 'C:\Users\justi\Desktop\BYU Campus Calendar'
$logDir = Join-Path $env:LOCALAPPDATA 'byu-campus-calendar'
$log = Join-Path $logDir 'refresh.log'

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }

# Writes to the log only, never to the pipeline. Say used to Write-Output as well, which meant
# Run returned [the label line, the exit code] instead of the exit code -- so "-ne 0" was true on
# an array of two and every step reported failure, including a clean "Already up to date."
function Say($msg) {
  $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $log -Value $line -Encoding utf8
}

# Runs a command with all its output appended to the log by cmd, not PowerShell. PS 5.1 wraps a
# native command's stderr in ErrorRecords and flips $? even on exit 0, so redirecting through
# cmd keeps npm's ordinary warnings from reading as failures.
function Run($label, $command) {
  Say "> $label"
  cmd /c "$command >> $log 2>&1"
  $code = $LASTEXITCODE
  Say "  $label exited $code"
  return $code
}

function Restore() {
  git checkout -- src/data/events.json
  Say 'snapshot restored from git; nothing committed'
}

Set-Location $repo
Say '=== refresh starting ==='

# Anything uncommitted other than the snapshot means a human is mid-edit. Leave it alone.
$dirty = @(git status --porcelain | Where-Object { $_ -notmatch 'src/data/events\.json' })
if ($dirty.Count -gt 0) {
  Say "ABORT: other uncommitted changes present -- $($dirty -join ' | ')"
  exit 1
}

if ((Run 'git pull --ff-only' 'git pull --ff-only') -ne 0) {
  Say 'ABORT: git pull --ff-only failed (remote has diverged?)'
  exit 1
}

if ((Run 'npm run build:data' 'npm run build:data') -ne 0) {
  Restore; Say 'ABORT: the pull or the demo seed failed'; exit 1
}

if ((Run 'npm run smoke' 'npm run smoke') -ne 0) {
  Restore; Say 'ABORT: smoke failed -- treating this as a bad pull, not a bad app'; exit 1
}

if ((Run 'npm run build' 'npm run build') -ne 0) {
  Restore; Say 'ABORT: build failed'; exit 1
}

git diff --quiet src/data/events.json
if ($LASTEXITCODE -eq 0) {
  Say 'no change to commit'   # generatedAt always moves, so this should be unreachable
  Say '=== refresh done ==='
  exit 0
}

$count = node -e "process.stdout.write(String(require('./src/data/events.json').events.filter(e => !e.demo).length))"
Say "committing $count real events"

git add src/data/events.json
git commit -m "Refresh event snapshot ($count real events)"
if ($LASTEXITCODE -ne 0) { Say 'ABORT: commit failed'; exit 1 }

if ((Run 'git push' 'git push origin main') -ne 0) {
  Say 'ABORT: push failed -- commit is local, next run will carry it'
  exit 1
}

Say "pushed; Vercel will redeploy from main"
Say '=== refresh done ==='
