# Feature Folders

Feature folders are the durable memory for agentic SDLC work.

Create a folder under `docs/features/<slug>/` for each feature. Use one of
the templates in this directory:

- `_template-small/` for small, low-risk changes.
- `_template-medium/` for medium changes that need a task plan and evidence.
- `_template/` for large or launch-gated changes.

The scripts in `scripts/feature-*` read and update these files so work can
resume across agents, sessions, and tools.
