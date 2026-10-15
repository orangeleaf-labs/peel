# Human to-do

Work that needs a person (credentials, signing material, hosting, artwork). Each item says
exactly what to do and where the result goes. Items are added as the fork progresses.

## Open

### Move the Git LFS test fixtures off `lfs.openpencil.dev`

`.lfsconfig` points Git LFS at `https://lfs.openpencil.dev`, upstream's server. The `.fig` and font
fixtures under `tests/fixtures/` (9 objects) are stored there, and 114 unit tests need them.

1. On a machine that can reach upstream's LFS server, run `git lfs fetch --all upstream`.
2. Enable Git LFS for `orangeleaf-labs/peel` on GitHub (or pick Orangeleaf's own LFS server).
3. Change `.lfsconfig` to that server (delete the file to use GitHub's), then `git lfs push --all origin`.
4. Open a PR with the `.lfsconfig` change and confirm `bun run test:unit` passes in full.
