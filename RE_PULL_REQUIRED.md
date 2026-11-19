# ONE-TIME ACTION REQUIRED: history was rewritten (19 Nov 2026)

The commit history of ALL branches was rewritten ONCE to remove a personal
email address from every commit. Every commit ID changed. The source code
is byte-identical — nothing about the app changed. This will NOT happen
again; you will never need to repeat the steps below.

## The fix — do it exactly ONCE (if your copy predates 19 Nov 2026)

1. Save any unfinished local work (copy uncommitted files somewhere safe).
2. `git fetch origin`
3. For each branch you have locally:
   `git checkout <branch>` then `git reset --hard origin/<branch>`
   (or simply delete your folder and clone fresh — simplest)

After this one re-sync you work completely normally again.

## NEVER push from an old copy — not once, not ever

The pre-rewrite history is PERMANENTLY RETIRED. Pushing or force-pushing
an old copy (from an old clone, an old backup, a USB stick) re-publishes
the removed email history and undoes the cleanup for everyone. There is no
second rewrite planned. If you still hold a copy made before 19 Nov 2026
after re-syncing, treat it as dead — delete it.

This notice file is temporary and will be removed once everyone has
re-synced.
