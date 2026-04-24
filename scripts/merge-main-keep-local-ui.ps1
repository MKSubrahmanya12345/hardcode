param(
  [string]$Remote = "mkhardcode",
  [string]$TargetBranch = "alden"
)

$ErrorActionPreference = "Stop"

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
  throw "Not inside a git repository."
}

Push-Location $repoRoot
try {
  $status = git status --porcelain
  if ($status) {
    throw "Working tree is not clean. Commit or stash changes before running this script."
  }

  $localHead = (git rev-parse HEAD).Trim()

  Write-Host "Fetching $Remote/main..."
  git fetch $Remote main

  Write-Host "Merging $Remote/main into current branch..."
  git merge --no-ff "$Remote/main"

  $uiFiles = @(
    "frontend/src/components/ProjectChat.jsx",
    "frontend/src/components/ProjectMainPage.jsx",
    "frontend/src/components/DesignChat.jsx",
    "frontend/src/pages/DesignPage.jsx",
    "frontend/src/index.css"
  )

  Write-Host "Re-applying local UI files from pre-merge commit..."
  foreach ($file in $uiFiles) {
    git checkout $localHead -- $file
  }

  $uiDiff = git diff --name-only
  if ($uiDiff) {
    git add $uiFiles
    git commit -m "chore(ui): preserve local UI after syncing main"
  }

  Write-Host "Pushing to $Remote/$TargetBranch..."
  git push $Remote "HEAD:$TargetBranch"

  Write-Host "Done. Local UI preserved and branch pushed." -ForegroundColor Green
}
finally {
  Pop-Location
}
