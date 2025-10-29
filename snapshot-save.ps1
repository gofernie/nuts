# snapshot-save.ps1 – Auto-save Git snapshot (safe for detached HEAD)
$date = Get-Date -Format "yyyy-MM-dd-HH-mm"
$branch = (git rev-parse --abbrev-ref HEAD).Trim()

if ($branch -eq "HEAD") {
  # create a branch automatically if you're in a worktree at a tag
  $branch = "baseline-auto"
  git switch -c $branch | Out-Null
}

$tag = "autosave-$date"

git add -A
git commit -m "Auto-save snapshot $date" --allow-empty
git tag -a $tag -m "Auto-save snapshot on $date"
git push origin $branch
git push origin $tag

Write-Host "`n✅ Auto-save complete on branch '$branch' → tag '$tag'`n"
