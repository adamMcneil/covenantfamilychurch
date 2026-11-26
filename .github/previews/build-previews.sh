#!/usr/bin/env bash
# Builds each preview branch into _site/preview/<branch>/ and puts the version picker on every
# page, previews and main site alike. Run by .github/workflows/deploy.yml after the main build;
# it can also be run locally after `npm run build` to try it out.
#
#   BASE              the site's path prefix without a trailing slash ("/covenantfamilychurch",
#                     or "" on a custom domain)
#   PREVIEW_BRANCHES  one preview per line: the branch name, then the label the picker shows
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
tmp=${RUNNER_TEMP:-$(mktemp -d)}
versions='[{"branch":"","label":"Current site"}'

while read -r branch label; do
  [ -z "$branch" ] && continue
  dir="$tmp/preview-$branch"
  rm -rf "$dir"
  git worktree prune
  if git fetch --depth 1 origin "refs/heads/$branch:refs/remotes/origin/$branch" \
    && git worktree add --detach "$dir" "origin/$branch" \
    && (cd "$dir" && npm ci && PATH_PREFIX="$BASE/preview/$branch/" npm run build && PATH_PREFIX="$BASE/preview/$branch/" npm run check); then
    mkdir -p "_site/preview/$branch"
    cp -r "$dir/_site/." "_site/preview/$branch/"
    versions+=",{\"branch\":\"$branch\",\"label\":\"${label:-$branch}\"}"
    echo "Preview of $branch built."
    [ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "Preview of $branch: $BASE/preview/$branch/" >> "$GITHUB_STEP_SUMMARY"
  else
    echo "::warning::The preview of branch $branch did not build; skipping it."
  fi
  git worktree remove --force "$dir" 2>/dev/null
done <<< "$PREVIEW_BRANCHES"
versions+=']'

# The picker: one script for every page, told which versions were built.
mkdir -p _site/preview
sed "s|__VERSIONS__|$versions|" "$here/picker.js" > _site/preview/picker.js
find _site -name '*.html' -print0 |
  xargs -0 sed -i "s|</body>|<script src=\"$BASE/preview/picker.js\" defer></script></body>|"
echo "Picker added with versions: $versions"
