---
name: ghl-copilot-change-log
description: Use after completing any feature, bugfix, or architectural change in the Voice AI Observability Copilot, before committing, to update the structured project changelog.
---

# Maintaining the GHL Copilot Changelog

The changelog lives at `CHANGELOG.md` in the project root.
Follows [Keep a Changelog](https://keepachangelog.com) + [Semantic Versioning](https://semver.org).

## Format

```markdown
## [Unreleased]

### Added
- Per-agent KPI configuration endpoint so users can define success criteria per agent without editing code

### Changed
- Analysis results now include a `confidence` score alongside each recommendation

### Fixed
- Webhook handler no longer drops transcripts when GHL sends duplicate call-completed events

### Removed
- Removed legacy `GET /api/transcripts/all` endpoint (use `/agents/:id/transcripts` instead)
```

## Entry Rules

| Good | Bad |
|---|---|
| States what changed AND why it matters | "Added endpoint" |
| User-facing or system-impact language | "Fixed bug" |
| References the feature by name | "Updated service" |
| One meaningful sentence | Vague platitudes |

**Template:** `<Action> <what> so that <why it matters>`

## Categories

| Category | Use when |
|---|---|
| `Added` | New feature, endpoint, component, or capability |
| `Changed` | Existing behavior modified (not a fix) |
| `Fixed` | Bug resolved |
| `Removed` | Feature, endpoint, or module deleted |
| `Security` | Vulnerability patched or auth hardened |

## When to Update

- After every completed feature task, before committing
- Commit the changelog **with** the feature code — never as a separate commit
- One entry per logical change, not per file touched

## On Release

When cutting a release, rename `[Unreleased]` to the version + date, then add a fresh `[Unreleased]` block above it:

```markdown
## [Unreleased]

## [1.2.0] - 2026-05-23
### Added
- ...
```

## CHANGELOG.md Bootstrap

If `CHANGELOG.md` does not exist yet, create it with:

```markdown
# Changelog

All notable changes to the Voice AI Observability Copilot are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [Unreleased]
```
