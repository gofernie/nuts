# always run inside this script's folder (the repo root)
Set-Location -Path $PSScriptRoot

# milestone-save.ps1 – creates a weekly or stable checkpoint
$date = Get-Date -Format "yyyy-MM-dd"
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -eq "HEAD") { $branch = "baseline-auto"; git switch -c $branch | Out-Null }

$tag = "site-milestone-$date"

git add -A
git commit -m "Weekly milestone $date" --allow-empty
git tag -a $tag -m "Weekly milestone on $date"
git push origin $branch
git push origin $tag

Write-Host "`n🏁 Milestone created '$tag' on branch '$branch'`n"
