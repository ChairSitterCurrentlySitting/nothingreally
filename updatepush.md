Keep forgetting how to do this.

# Git Push Guide — nothingreally

Reference this whenever you want to push local changes live. Your repo is
already fully set up — this is just the repeatable update cycle, not
first-time setup.

## Every time you want to push

```bash
git add .
git commit -m "describe what changed"
git push
```

That's the whole cycle. No need to repeat any setup commands (`git init`,
`git remote add`, etc.) — those only happen once, and you've already done
them.

## Before you commit, a quick sanity check

Run `git status` first. It lists every file Git currently sees as
changed. Worth a glance — `git add .` stages whatever's actually on disk,
so if you forgot to overwrite a file locally with something Claude gave
you, it just won't be included, silently, with no error.

## After pushing

- GitHub Pages rebuilds automatically, usually within about a minute.
- **Hard refresh** the live page (`Ctrl+Shift+R` / `Cmd+Shift+R`) — a
  normal refresh can show a cached old version.
- Live URL: **https://chairsittercurrentlysitting.github.io/nothingreally/**
  (not the `github.com/...` repo page — that's just the file browser and
  never runs the game).

## Prefer clicking over typing?

VS Code's **Source Control** tab (the branching-line icon, left sidebar)
does the exact same thing with buttons:
1. Review the changed files listed there.
2. Type a commit message in the box at the top.
3. Click the checkmark to commit.
4. Click **Sync Changes** to push.

## If something goes wrong

**Stuck in a weird screen with `~` down the left and `-- INSERT --` at the
bottom?** That's Vim, not a crash — it opened to ask for a commit message.
Press `Escape`, type `:wq`, press Enter. That saves and exits.

**`git push` rejected — "remote contains work you do not have locally"?**
Someone/something (e.g. GitHub's own web editor, or a fresh clone) has
commits your local copy doesn't. Run:
```bash
git pull origin main --no-rebase
```
If it opens Vim for a merge message, same fix as above. If it reports a
conflict in a specific file, open that file, resolve the conflicting
sections, then:
```bash
git add .
git commit -m "merge"
git push
```

**A file you *know* you replaced doesn't seem to have actually changed?**
Reopen it in VS Code and check the exact content matches what you were
given — this project has hit a few cases where a download didn't fully
overwrite the old version. Re-download and re-save if it doesn't match.