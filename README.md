# OpenProject MCP for Orca (`mcp-openproject`)

A hybrid **Orca Sidebar Plugin + Rust MCP Server** for **OpenProject Community Edition (CE)**.

OpenProject's official built-in MCP server requires a paid Enterprise plan. This project connects coding agents and Orca directly to any self-hosted **OpenProject Community Edition (CE)** instance for free using standard OpenProject API v3 tokens.

---

## Architecture & Key Features

### 1. Orca Sidebar Plugin ([`orca-plugin.json`](orca-plugin.json), [`src/panel.tsx`](src/panel.tsx), [`src/worker.ts`](src/worker.ts))
- **Tickets & Subtasks Browser (`ui: "components"`)**: Browse OpenProject projects and work packages, filter by `Mine`, priority, project, status, or keyword, and navigate parent/child subtask hierarchies in-place.
- **Orca-Native Agent & Worktree Launch Drawer**: Launch an coding agent (`antigravity`/`agy`, `codex`, `claude`, `gemini`, `cursor-agent`, `opencode`, `kilocode`, `droid`, `omp`, `pi`, `grok`) either in an **Existing Workspace** or in a **New Worktree** (`op-<id>-<slug>`) with automatic repository matching and terminal focus.
- **1-Click Global MCP Registration & Auto-Injected Env (`agent.launch.before`)**: Configure your OpenProject `Base URL` and `API Token` once in the **Setup** tab. Click **Register MCP** to write the MCP server config to your agent's global config file (`~/.claude.json`, `~/.codex/config.toml`, or `~/.gemini/config/mcp_config.json`), and let the plugin automatically inject `OPENPROJECT_*` environment variables across all of your git worktrees on launch.
- **1-Click Task Creation & Updates in UI**: Create tasks/subtasks and update status, assignee, responsible user, or comments directly from the Orca sidebar.
- **Bilingual UI (`EN` / `VI`)**: Switch between English and natural Vietnamese developer terminology from the header bar.

### 2. Rust Stdio MCP Server ([`Cargo.toml`](Cargo.toml), [`rust/main.rs`](rust/main.rs), [`rust/tools.rs`](rust/tools.rs))
- **Fast Single-Binary Server**: Model Context Protocol (`JSON-RPC 2.0` over stdio) server written in Rust.
- **Context-Frugal HAL Compaction**: Supports `select` field projection to minimize LLM token usage.
- **Defense-in-Depth Project Allowlists**: Enforces fail-closed `OPENPROJECT_READ_PROJECTS` and `OPENPROJECT_WRITE_PROJECTS` scope checks.
- **Guarded 2-Step Agent Writes (`Preview -> Confirm`)**: All MCP write tools called by AI agents validate against OpenProject `/form` schemas and check `lockVersion` optimistic concurrency (`confirm=false` to preview changes, then `confirm=true` to execute).

---

## Included MCP Tools (17 Tools in Rust Binary)

| Tool | Category | Description |
| :--- | :--- | :--- |
| `get_current_user` | Meta | Verify authentication and inspect the current OpenProject user |
| `list_statuses` | Meta | List workflow statuses (`New`, `In progress`, `Developed`, `Closed`, etc.) |
| `list_types` | Meta | List work package types (`Task`, `Bug`, `Feature`, `Epic`, `Milestone`, etc.) |
| `list_priorities` | Meta | List work package priorities (`Low`, `Normal`, `High`, `Immediate`) |
| `list_projects` | Project Read | List accessible projects filtered by `OPENPROJECT_READ_PROJECTS` |
| `get_project` | Project Read | Get project metadata by identifier, name, or numeric ID |
| `get_project_work_package_context` | Project Read | Inspect project statuses, types, priorities, and write permissions |
| `list_work_packages` | Ticket Read | List work packages by `project`, `status`, `type`, `priority`, `assignee`, `limit`, and `select` |
| `search_work_packages` | Ticket Read | Search work packages by keyword across subject and description |
| `list_my_open_work_packages` | Ticket Read | List open work packages assigned to the authenticated user |
| `get_work_package` | Ticket Read | Fetch full details of a work package by `id` (supports `select`) |
| `get_work_packages` | Ticket Read | Batch-read multiple work packages by numeric `ids` (supports `select`) |
| `get_work_package_activities` | Ticket Read | Fetch comments and activity history for a work package |
| `create_work_package` | Guarded Write | Preview (`confirm=false`) then create (`confirm=true`) a work package |
| `create_subtask` | Guarded Write | Preview (`confirm=false`) then create (`confirm=true`) a child task under `parent_work_package_id` |
| `update_work_package` | Guarded Write | Preview (`confirm=false`) then update (`confirm=true`) status, subject, description, or comment |
| `add_work_package_comment` | Guarded Write | Preview (`confirm=false`) then post (`confirm=true`) a markdown comment |

---

## Quick Start

### Step 1: Install the Rust MCP Binary (`mcp-openproject`)

```bash
# Clone the repository and install the binary into ~/.cargo/bin/mcp-openproject
git clone https://github.com/IvanHa-dev/mcp-openproject.git
cd mcp-openproject
cargo install --path .
```

### Step 2: Configure in the Orca Plugin (Recommended — 1-Click Setup)

1. Install **OpenProject MCP for Orca** from the Orca Plugin Marketplace (`IvanHa-dev/mcp-openproject`).
2. Open the **OpenProject** sidebar panel and go to the **Setup** tab.
3. Enter your **Base URL** (e.g. `https://openproject.example.com`) and your OpenProject **API Token** (generated under *OpenProject -> My Account -> Access tokens -> API*).
4. Select your **Default Agent CLI** and click **Save Settings**, then click **Register MCP**.
   - This automatically registers `mcp-openproject` in your agent's global configuration (`~/.claude.json`, `~/.codex/config.toml`, or `~/.gemini/config/mcp_config.json`) and injects credentials on every agent launch across all git worktrees.

---

## Manual MCP Configuration (Without Orca or for Other MCP Clients)

If you prefer to configure your coding agent manually:

### Antigravity / Gemini CLI (`~/.gemini/config/mcp_config.json`)

```json
{
  "mcpServers": {
    "openproject": {
      "command": "mcp-openproject",
      "args": [],
      "env": {
        "OPENPROJECT_BASE_URL": "https://openproject.example.com",
        "OPENPROJECT_API_TOKEN": "opapi-...",
        "OPENPROJECT_READ_PROJECTS": "*",
        "OPENPROJECT_WRITE_PROJECTS": "*"
      }
    }
  }
}
```

### Claude Code (`~/.claude.json`)

```json
{
  "mcpServers": {
    "openproject": {
      "command": "mcp-openproject",
      "env": {
        "OPENPROJECT_BASE_URL": "https://openproject.example.com",
        "OPENPROJECT_API_TOKEN": "opapi-...",
        "OPENPROJECT_READ_PROJECTS": "*",
        "OPENPROJECT_WRITE_PROJECTS": "*"
      }
    }
  }
}
```

### OpenAI Codex (`~/.codex/config.toml`)

```toml
[mcp_servers.openproject]
command = "mcp-openproject"

[mcp_servers.openproject.env]
OPENPROJECT_BASE_URL = "https://openproject.example.com"
OPENPROJECT_API_TOKEN = "opapi-..."
OPENPROJECT_READ_PROJECTS = "*"
OPENPROJECT_WRITE_PROJECTS = "*"
```

---

## Development & Testing

```bash
# Run Rust MCP server unit and mock HTTP integration tests
cargo test

# Validate Orca plugin manifest offline
orca plugin validate . --json

# Render panel scenarios and verify worker handlers
orca plugin check . --json

# Run panel and worker test suites
orca plugin test . --json

# Load or reload in Orca for local development
orca plugin dev reload . --json
```

---

## Acknowledgments & License

Inspired by [jtauschl/openproject-ce-mcp](https://github.com/jtauschl/openproject-ce-mcp) (MIT License).
Licensed under the [MIT License](LICENSE).
