# Changelog

All notable changes to **OpenProject MCP for Orca (`mcp-openproject`)** will be documented in this file.

## [0.1.3] - 2026-04-11

### Added
- **Orca-Native Worktree & Agent Launch Drawer**:
  - Top-level mode switch between **Existing Workspace** (all open worktrees/branches) and **New Worktree** (deduplicated Repository selector + editable `op-<id>-<slug>` branch name).
  - Dynamic **Agent CLI** selector populated from locally detected agent binaries (`antigravity`/`agy`, `codex`, `claude`, `gemini`, `cursor-agent`, `opencode`, etc.).
- **Native Scroll-Anchoring Auto-Scroll**: Smoothly scroll to parent/child work packages without reordering the task list, and expand the subtask scrollable container height.

### Changed
- **Subtask Navigation**: Keep subtasks inside a bounded scrollable container and swap parent/child slots in-place when navigating task hierarchies.
- **Cleaner Bilingual UI Labels (`en` / `vi`)**: Removed redundant parenthetical explanations from form labels and dropdown options.

### Fixed
- **Zero Orphan Terminal Sessions on Agent Launch**:
  - Added Windows (`%LOCALAPPDATA%\Programs\orca\resources\bin\orca.exe`) and macOS (`/Applications/Orca.app/Contents/Resources/bin/orca`) CLI resolution in `resolveOrcaCliPath()`.
  - Resolved repository ID (`id:<repoId>`) when creating worktrees so creating a new worktree from a child worktree never fails or falls back to an unfocused session.
  - Automatically reuse and focus existing `op-<id>-<slug>` worktrees if already created.
- **Filter Bar Stability**: Keep `TicketFilters` mounted during scroll pulse animations and reset sibling `<Select>` portals cleanly.

## [0.1.2] - 2026-04-11

### Changed
- Streamlined Orca worker agent launch integration using the Orca host API.

## [0.1.1] - 2026-04-11

### Added
- **Parent/Child Task Navigation**: Auto-focus parent and child work packages in the ticket list and support smart worktree agent launch matching.

### Fixed
- **IPC Payload Cap**: Keep `OpenProjectStateSnapshot` under Orca's 256 KiB IPC limit and fix project filter reset behavior.

## [0.1.0] - 2026-04-10

### Added
- Initial release of **OpenProject MCP for Orca** (`IvanHa-dev/mcp-openproject`).
- **Orca Sidebar Plugin (`ui: "components"`)**: Browse projects and work packages, filter by project/status/priority/keyword, inspect ticket details and activity comments, and create/update work packages with Guarded 2-Step Writes (`Preview -> Confirm`).
- **Automatic Agent Environment Hook (`agent.launch.before`)**: Inject `OPENPROJECT_BASE_URL`, `OPENPROJECT_API_TOKEN`, `OPENPROJECT_READ_PROJECTS`, and `OPENPROJECT_WRITE_PROJECTS` automatically when Orca starts an agent CLI.
- **One-Click Global MCP Registration**: Register the OpenProject MCP server in `~/.claude.json`, `~/.codex/config.toml`, or `~/.gemini/config/mcp_config.json`.
- **Rust Stdio MCP Server (`mcp-openproject`)**: 17 MCP tools for OpenProject Community Edition (CE) with context-frugal HAL compaction, fail-closed project allowlists, and `lockVersion` optimistic concurrency.
