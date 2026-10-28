# ContextOS

ContextOS is a local-first workspace for projects, notes, decisions, documents, links, sessions, relationships, and recorded activity. No account, AI service, cloud sync, or operating-system monitoring is required.

## Run and test

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

The browser version stores a workspace in IndexedDB for the current browser profile. Data is not synchronized, backed up automatically, or encrypted. Export a JSON backup in Settings. Restoring validates schema and references, then explicitly replaces the current workspace. TXT and Markdown imports store a text copy; they do not modify the original file. Notes can be exported as Markdown. Ctrl/Cmd+K opens the command palette.

## Desktop

The Tauri 2 shell uses the official SQL plugin with SQLite at `sqlite:contextos.db` in the app data directory. A versioned JSON workspace is persisted in one SQLite row with parameterized queries. This atomic snapshot is separate from browser IndexedDB. Tauri's documented platform dependencies and Rust toolchain are required. Run `npm run tauri dev` or `npm run tauri build` on a configured desktop machine. The current development environment lacks Rust/Cargo and desktop webview dependencies, so the native build has not been verified.

## Search and graph

Search is a local, case-insensitive text match on current records, titles, tags, metadata and imported text. There is no separate index, FTS5, or semantic search. The graph displays explicitly created relationships and supports zoom, pan and node selection. Project associations are stored as fields and are not automatically presented as graph edges. Activity records only actions in the app; it does not reconstruct previous file versions.

## Limitations

This initial release does not implement FTS5, native file path references, PDF extraction, Markdown rendering, orphan analysis, context decay, semantic search, or automatic cloud synchronization. Edits are saved when a field loses focus. A failed save is surfaced in the interface; keep the tab open and export a backup. The desktop adapter and packaging require testing on a supported Tauri host. See LICENSE for terms.
