# Phase 7 — Packaging, Agent Store entry and the app hook

## Principle
The agent ships as a package. The app gets **one generic feature** ("package agents can contribute tools that run a local CLI"), never video-specific code. Future downloadable agents reuse it.

## Package manifest (`agent/manifest.json`)
```json
{
  "id": "video-studio",
  "name": "Video Studio Agent",
  "icon": "🎬",
  "version": "0.1.0",
  "category": "media",
  "description": "Makes animated ads, demos and reels with voiceover, music and captions.",
  "systemPrompt": "…(from 06)…",
  "allowedTools": ["read_file","write_file","edit_file","list_directory","browser_navigate","browser_screenshot",
                   "video_templates","video_validate","video_preview","video_render","video_capture","video_doctor"],
  "package": {
    "runtime": "node>=18",
    "entry": "bin/opscode-video.mjs",
    "tarball": "https://github.com/shashi-faced/opscode-video-studio/archive/refs/tags/v0.1.0.tar.gz",
    "postInstall": "doctor --install",
    "tools": [ { "name": "video_render", "description": "…", "parameters": { … } }, … ]
  }
}
```

## App changes (generic, small)
1. `agentStoreTypes.ts`: optional `package?: AgentPackage` on `AgentManifest`; new category `media`.
2. `agentStoreCatalog.ts`: add the Video Studio manifest to `DEFAULT_AGENT_CATALOG` (not `BUILTIN_AGENTS`), so it shows as **Download** in the store.
3. `installedAgentsStore.installAgent`: if `package` is present, run the real install through `execute_bash`:
   - install dir `~/.opscode/agents/<id>/<version>`;
   - dev source: copy from the module folder; release: download + extract tarball;
   - `npm install --omit=dev`, then `node <entry> doctor --install`;
   - stream progress to the install button; on failure show the CLI's JSON error.
   Uninstall removes the folder.
4. `models/tools.ts`: `getToolsForAgent(agentId)` appends `package.tools` of the active installed agent.
5. `toolExecutor.ts`: before the fallback, if the tool belongs to an installed package, run
   `node <installDir>/<entry> tool <name> '<json params>'` with the workspace as cwd, parse the last JSON line, attach `image` if returned. Long renders run with a generous timeout and stream progress lines into the terminal panel.

## Distribution
- `npm pack` in the module → `video-studio-<ver>.tgz` (bundle size small; deps installed on the user's machine).
- Optional later: Node single-executable build per OS so users without Node can install.

## Done when
- In the app: Store → Video Studio → Download → tab appears → prompt "make a 20 second reel about Opscode" produces an MP4.
- Uninstall removes the tab and the folder.
