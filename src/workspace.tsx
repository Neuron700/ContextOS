import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Command,
  FileText,
  Folder,
  GitFork,
  Link2,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Shield,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  addRelation,
  demoWorkspace,
  emptyWorkspace,
  makeEntity,
  record,
  relationTypes,
  removeEntity,
  removeRelation,
  safeUrl,
  search,
  validateBackup,
  type Entity,
  type Relation,
  type Workspace,
} from "./lib/domain";
import { createRepository, type Repository } from "./lib/storage";
type View =
  | "home"
  | "projects"
  | "search"
  | "graph"
  | "timeline"
  | "notes"
  | "decisions"
  | "documents"
  | "settings";
const navigation: { id: View; label: string; icon: typeof Activity }[] = [
  { id: "home", label: "Home", icon: Activity },
  { id: "projects", label: "Projects", icon: Folder },
  { id: "search", label: "Global search", icon: Search },
  { id: "graph", label: "Knowledge graph", icon: GitFork },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "notes", label: "Notes", icon: BookOpen },
  { id: "decisions", label: "Decisions", icon: Check },
  { id: "documents", label: "Documents & links", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];
const typeLabel: Record<Entity["type"], string> = {
  project: "PROJECT",
  note: "NOTE",
  document: "DOCUMENT",
  link: "LINK",
  decision: "DECISION",
  session: "SESSION",
};
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const shortDate = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export default function App() {
  const [state, setState] = useState<Workspace>(emptyWorkspace),
    [repository, setRepository] = useState<Repository | null>(null),
    [view, setView] = useState<View>("home"),
    [activeId, setActiveId] = useState(""),
    [projectFilter, setProjectFilter] = useState(""),
    [query, setQuery] = useState(""),
    [typeFilter, setTypeFilter] = useState(""),
    [ready, setReady] = useState(false),
    [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
      "saved",
    ),
    [message, setMessage] = useState(""),
    [collapsed, setCollapsed] = useState(false),
    [showArchived, setShowArchived] = useState(false),
    [palette, setPalette] = useState(false),
    [relationTarget, setRelationTarget] = useState(""),
    [relationType, setRelationType] = useState<Relation["type"]>("related_to"),
    [restore, setRestore] = useState<Workspace | null>(null);
  const queue = useRef(Promise.resolve()),
    stateRef = useRef(state),
    version = useRef(0);
  stateRef.current = state;
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await createRepository();
        const data = await r.load();
        if (alive) {
          setRepository(r);
          setState(data);
          stateRef.current = data;
        }
      } catch (e) {
        if (alive) {
          setSaveStatus("error");
          setMessage(`Storage could not be opened: ${String(e)}`);
        }
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const persist = useCallback(
    (next: Workspace) => {
      if (!repository) {
        setMessage("Storage is unavailable. Changes cannot be saved.");
        return;
      }
      stateRef.current = next;
      setState(next);
      setSaveStatus("saving");
      const current = ++version.current;
      queue.current = queue.current
        .catch(() => {})
        .then(() => repository.save(next))
        .then(() => {
          if (current === version.current) setSaveStatus("saved");
        })
        .catch((e) => {
          setSaveStatus("error");
          setMessage(
            `Save failed: ${String(e)}. Keep this tab open and retry an edit.`,
          );
        });
    },
    [repository],
  );
  const update = (
    entity: Entity,
    changes: Partial<Entity>,
    action = "updated",
  ) => {
    const next = { ...entity, ...changes, updatedAt: new Date().toISOString() };
    persist(record(stateRef.current, next, action));
  };
  const create = (
    type: Entity["type"],
    title?: string,
    projectId = projectFilter || null,
  ) => {
    const name = title || window.prompt(`Name for new ${type}:`);
    if (!name?.trim()) return;
    const e = makeEntity(type, name, type === "project" ? null : projectId);
    persist(record(stateRef.current, e, "created"));
    setActiveId(e.id);
    setView(
      type === "project"
        ? "projects"
        : type === "note"
          ? "notes"
          : type === "decision"
            ? "decisions"
            : type === "document" || type === "link"
              ? "documents"
              : "home",
    );
  };
  const active = state.entities.find((e) => e.id === activeId);
  const projects = state.entities.filter(
    (e) => e.type === "project" && !e.archived,
  );
  const sessions = state.entities
    .filter((e) => e.type === "session" && !e.archived)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const recent = [...state.entities]
    .filter((e) => !e.archived)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const filtered = useMemo(
    () => search(state, query, typeFilter, projectFilter),
    [state, query, typeFilter, projectFilter],
  );
  const viewTypes: Partial<Record<View, Entity["type"][]>> = {
    projects: ["project"],
    notes: ["note"],
    decisions: ["decision"],
    documents: ["document", "link"],
  };
  const visible = (view === 'projects' && showArchived
    ? state.entities.filter(e => e.type === 'project' && e.archived && e.title.toLowerCase().includes(query.toLowerCase()))
    : filtered).filter(
    (e) => !viewTypes[view] || viewTypes[view]!.includes(e.type),
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const open = (e: Entity) => {
    setActiveId(e.id);
    setView(
      e.type === "project"
        ? "projects"
        : e.type === "note"
          ? "notes"
          : e.type === "decision"
            ? "decisions"
            : e.type === "document" || e.type === "link"
              ? "documents"
              : "home",
    );
  };
  const graphNodes: Node[] = useMemo(
    () =>
      filtered
        .slice(0, 150)
        .map((e, i) => ({
          id: e.id,
          position: { x: (i % 4) * 235, y: Math.floor(i / 4) * 135 },
          data: { label: `${typeLabel[e.type]}\n${e.title}` },
          style: {
            background: e.id === activeId ? "#ef663d" : "#202126",
            color: "#fff",
            border: `1px solid ${e.id === activeId ? "#ff956e" : "#525158"}`,
            borderRadius: 6,
            padding: "12px",
            width: 190,
            whiteSpace: "pre-line",
            fontSize: 11,
          },
        })),
    [filtered, activeId],
  );
  const nodeIds = new Set(graphNodes.map((n) => n.id));
  const graphEdges: Edge[] = state.relations
    .filter((r) => nodeIds.has(r.source) && nodeIds.has(r.target))
    .map((r) => ({
      id: r.id,
      source: r.source,
      target: r.target,
      label: r.type,
      style: { stroke: "#d67555" },
      labelStyle: { fill: "#d9b0a0", fontSize: 10 },
    }));
  const importDocument = async (file: File) => {
    if (file.size > 2_000_000) {
      setMessage("Text documents must be smaller than 2 MB.");
      return;
    }
    if (!/\.(txt|md|markdown)$/i.test(file.name)) {
      setMessage("Only TXT and Markdown files are supported.");
      return;
    }
    try {
      const body = await file.text();
      const e = makeEntity("document", file.name, projectFilter || null);
      e.body = body;
      e.meta = {
        extraction: "Imported text copy",
        original: "Original file is unchanged",
      };
      persist(record(stateRef.current, e, "document imported"));
      setActiveId(e.id);
      setView("documents");
    } catch {
      setMessage("The document could not be read.");
    }
  };
  const addLink = () => {
    const url = prompt("Link URL (https:// or http://):");
    if (!url) return;
    if (!safeUrl(url)) {
      setMessage("Only valid HTTP or HTTPS URLs are accepted.");
      return;
    }
    const title = prompt("Link title:", url);
    if (!title?.trim()) return;
    const e = makeEntity("link", title, projectFilter || null);
    e.url = url;
    persist(record(stateRef.current, e, "link saved"));
    setActiveId(e.id);
    setView("documents");
  };
  const exportBackup = () =>
    download(
      "contextos-backup.json",
      JSON.stringify(state, null, 2),
      "application/json",
    );
  const addDemo = () => {
    if (
      state.entities.length &&
      !confirm("Add synthetic demo content to this workspace?")
    )
      return;
    const d = demoWorkspace();
    persist({
      version: 1,
      entities: [...state.entities, ...d.entities],
      relations: [...state.relations, ...d.relations],
      activities: [...d.activities, ...state.activities],
    });
    setMessage(
      "Synthetic demo added. You can delete the demo records at any time.",
    );
  };
  return (
    <div className="app">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <button className="logo" onClick={() => setView("home")}>
          <span className="mark">
            C<span>×</span>
          </span>
          {!collapsed && (
            <span>
              CONTEXT<em>OS</em>
              <small>PERSONAL WORKSPACE</small>
            </span>
          )}
        </button>
        <div className="sideCaption">{!collapsed && "YOUR WORKSPACE / 01"}</div>
        <nav>
          {navigation.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => setView(n.id)}
              title={n.label}
            >
              <n.icon size={17} />
              {!collapsed && <span>{n.label}</span>}
              {view === n.id && !collapsed && <span className="arrow">↗</span>}
            </button>
          ))}
        </nav>
        <div className="sideBottom">
          {!collapsed && (
            <div className="privacy">
              <Shield size={16} />
              <div>
                <b>YOUR DATA, YOUR DEVICE</b>
                <p>No cloud sync or AI required.</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle sidebar"
          >
            <Menu size={17} />
            {!collapsed && " Collapse sidebar"}
          </button>
        </div>
      </aside>
      <div className="main">
        <header>
          <div className="crumb">
            WORKSPACE <span>/</span>{" "}
            {navigation.find((n) => n.id === view)?.label.toUpperCase()}
          </div>
          <div className="topActions">
            <button className="searchButton" onClick={() => setPalette(true)}>
              <Search size={15} /> Search your context <kbd>⌘ K</kbd>
            </button>
            <span className={`saveStatus ${saveStatus}`}>
              ●{" "}
              {saveStatus === "saved"
                ? "SAVED"
                : saveStatus === "saving"
                  ? "SAVING"
                  : "SAVE ERROR"}
            </span>
            <button className="primary small" onClick={() => create("note")}>
              <Plus size={15} /> New note
            </button>
          </div>
        </header>
        <main>
          {message && (
            <div className="notice" role="status">
              {message}
              <button onClick={() => setMessage("")} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          )}
          {!ready && <p>Opening local workspace…</p>}
          {view === "home" && (
            <>
              <section className="hero">
                <div className="heroText">
                  <div className="overline">
                    <i /> YOUR PERSONAL CONTEXT ENGINE <span> / SYSTEM 01</span>
                  </div>
                  <h1>
                    YOUR WORK
                    <br />
                    <em>HAS CONTEXT.</em>
                  </h1>
                  <p>
                    Find the thread, reconnect the dots, and pick up exactly
                    where you left off.
                  </p>
                  <div className="heroButtons">
                    <button
                      className="primary"
                      onClick={() => create("session")}
                    >
                      Start a session <ArrowRight size={16} />
                    </button>
                    <button
                      className="secondary"
                      onClick={() => setView("graph")}
                    >
                      <GitFork size={15} /> Explore graph
                    </button>
                  </div>
                  <div className="heroFooter">
                    LOCAL FIRST <span>✳</span> BUILT FOR DEEP WORK
                  </div>
                </div>
                <div className="heroArt" aria-hidden="true">
                  <div className="sun" />
                  <div className="orbit a" />
                  <div className="orbit b" />
                  <div className="heroGlyph">
                    C<span>×</span>
                  </div>
                  <span className="artTag">
                    CONTEXT
                    <br />
                    IS EVERYTHING
                    <br />— 001
                  </span>
                  <i className="spark s1">✳</i>
                  <i className="spark s2">✦</i>
                </div>
              </section>
              <div className="overviewStats">
                <div>
                  <span>ACTIVE PROJECTS</span>
                  <strong>{projects.length.toString().padStart(2, "0")}</strong>
                  <small>YOUR WORKSPACES</small>
                </div>
                <div>
                  <span>NOTES CAPTURED</span>
                  <strong>
                    {state.entities
                      .filter((e) => e.type === "note" && !e.archived)
                      .length.toString()
                      .padStart(2, "0")}
                  </strong>
                  <small>IDEAS IN CONTEXT</small>
                </div>
                <div>
                  <span>CONNECTIONS</span>
                  <strong>
                    {state.relations.length.toString().padStart(2, "0")}
                  </strong>
                  <small>EXPLICIT LINKS</small>
                </div>
                <div>
                  <span>WORK SESSIONS</span>
                  <strong>{sessions.length.toString().padStart(2, "0")}</strong>
                  <small>RECORDED BY YOU</small>
                </div>
              </div>
              <div className="sectionHead">
                <div>
                  <div className="eyebrow">01 / PICK UP THE THREAD</div>
                  <h2>
                    Resume work<span>.</span>
                  </h2>
                </div>
                <button
                  className="textButton"
                  onClick={() => create("session")}
                >
                  New session <ArrowRight size={14} />
                </button>
              </div>
              {sessions.length ? (
                <div className="sessionGrid">
                  {sessions.slice(0, 3).map((s, i) => (
                    <button
                      className="sessionCard"
                      key={s.id}
                      onClick={() => open(s)}
                    >
                      <div className="sessionTop">
                        <span className="sessionIcon">
                          <Activity size={19} />
                        </span>
                        <span>0{i + 1} / SESSION</span>
                      </div>
                      <h3>{s.title}</h3>
                      <p>{s.body || "No note recorded yet."}</p>
                      <div className="sessionFoot">
                        <span>{s.nextAction || "No next action recorded"}</span>
                        <ArrowRight size={14} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  No sessions yet. Start one and record your next action.{" "}
                  <button onClick={() => create("session")}>
                    Start a session →
                  </button>
                </div>
              )}
              <div className="homeGrid">
                <section className="panel">
                  <div className="panelHead">
                    <div>
                      <div className="eyebrow">02 / YOUR PROJECTS</div>
                      <h2>Active spaces</h2>
                    </div>
                    <button
                      className="textButton"
                      onClick={() => setView("projects")}
                    >
                      View all ↗
                    </button>
                  </div>
                  {projects.slice(0, 4).map((p) => (
                    <button
                      className="compactRow"
                      key={p.id}
                      onClick={() => open(p)}
                    >
                      <span className="tile">
                        <Folder size={16} />
                      </span>
                      <span>
                        <b>{p.title}</b>
                        <small>
                          {p.status} ·{" "}
                          {
                            state.entities.filter((e) => e.projectId === p.id)
                              .length
                          }{" "}
                          linked records
                        </small>
                      </span>
                      <Chevron />
                    </button>
                  ))}
                  {!projects.length && (
                    <p className="muted">
                      Create a project to organize your work.
                    </p>
                  )}
                </section>
                <section className="panel">
                  <div className="panelHead">
                    <div>
                      <div className="eyebrow">03 / RECORDED ACTIVITY</div>
                      <h2>Recent signals</h2>
                    </div>
                    <button
                      className="textButton"
                      onClick={() => setView("timeline")}
                    >
                      Timeline ↗
                    </button>
                  </div>
                  {state.activities.slice(0, 4).map((a) => (
                    <button
                      className="activityRow"
                      key={a.id}
                      onClick={() => {
                        const e = state.entities.find(
                          (x) => x.id === a.entityId,
                        );
                        if (e) open(e);
                      }}
                    >
                      <i />
                      <span>
                        <b>{a.description}</b>
                        <small>{shortDate(a.at)}</small>
                      </span>
                    </button>
                  ))}
                  {!state.activities.length && (
                    <p className="muted">
                      Activity appears when you create or update records.
                    </p>
                  )}
                </section>
              </div>
              {!state.entities.length && (
                <div className="demoPrompt">
                  <span>NEW HERE?</span>
                  <b>
                    Start with a clean slate or explore synthetic demo content.
                  </b>
                  <button className="secondary" onClick={addDemo}>
                    Load demo ↗
                  </button>
                </div>
              )}
            </>
          )}
          {["projects", "notes", "decisions", "documents", "search"].includes(
            view,
          ) && (
            <>
              <div className="pageHead">
                <div>
                  <div className="eyebrow">
                    WORKSPACE / {view.toUpperCase()}
                  </div>
                  <h1>
                    {navigation.find((n) => n.id === view)?.label}
                    <span>.</span>
                  </h1>
                  <p>
                    Everything shown here comes from records you created or
                    imported.
                  </p>
                </div>
                <div className="buttonGroup">
                  {view === "documents" && (
                    <>
                      <label className="secondary upload">
                        <Upload size={15} /> Import text
                        <input
                          type="file"
                          accept=".txt,.md,.markdown"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) importDocument(f);
                          }}
                        />
                      </label>
                      <button className="secondary" onClick={addLink}>
                        <Link2 size={15} /> Save link
                      </button>
                    </>
                  )}
                  {view !== "search" && view !== "documents" && (
                    <button
                      className="primary"
                      onClick={() =>
                        create(
                          view === "projects"
                            ? "project"
                            : view === "decisions"
                              ? "decision"
                              : "note",
                        )
                      }
                    >
                      <Plus size={15} /> New{" "}
                      {view === "projects"
                        ? "project"
                        : view === "decisions"
                          ? "decision"
                          : "note"}
                    </button>
                  )}
                </div>
              </div>
              <div className="toolbar">
                <label>
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search titles, text, tags, and metadata…"
                  />
                </label>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  aria-label="Filter by project"
                >
                  <option value="">All projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                {view === "search" && (
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    aria-label="Filter by type"
                  >
                    <option value="">All types</option>
                    {[
                      "project",
                      "note",
                      "document",
                      "link",
                      "decision",
                      "session",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                )}
                {view === 'projects' && <button className="secondary" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Show active' : 'Show archived'}</button>}
                <span>{visible.length} RESULTS</span>
              </div>
              <div className="workspaceGrid">
                <section className="panel listPanel">
                  <div className="panelHead">
                    <div>
                      <div className="eyebrow">YOUR RECORDS</div>
                      <h2>{navigation.find((n) => n.id === view)?.label}</h2>
                    </div>
                    <span className="pill">{visible.length}</span>
                  </div>
                  {visible.map((e) => (
                    <button
                      className={`recordRow ${e.id === activeId ? "selected" : ""}`}
                      key={e.id}
                      onClick={() => setActiveId(e.id)}
                    >
                      <span className="tile">
                        {e.type === "project" ? (
                          <Folder size={16} />
                        ) : e.type === "link" ? (
                          <Link2 size={16} />
                        ) : (
                          <FileText size={16} />
                        )}
                      </span>
                      <span>
                        <b>{e.title}</b>
                        <small>
                          {typeLabel[e.type]} · {shortDate(e.updatedAt)}{" "}
                          {e.tags.length ? `· ${e.tags.join(", ")}` : ""}
                        </small>
                      </span>
                      <Chevron />
                    </button>
                  ))}
                  {!visible.length && (
                    <div className="empty">
                      No records match. Create a record or change the filter.
                    </div>
                  )}
                </section>
                <Inspector
                  entity={active}
                  state={state}
                  update={update}
                  onDelete={() => {
                    if (
                      active &&
                      confirm(
                        "Delete this record? Related links will be removed. Project contents will be kept and unassigned.",
                      )
                    ) {
                      persist(removeEntity(stateRef.current, active.id));
                      setActiveId("");
                    }
                  }}
                  onOpen={open}
                  onRelate={() => {
                    if (!active) return;
                    try {
                      persist(
                        addRelation(
                          stateRef.current,
                          active.id,
                          relationTarget,
                          relationType,
                        ),
                      );
                      setRelationTarget("");
                    } catch (e) {
                      setMessage(String(e));
                    }
                  }}
                  relationTarget={relationTarget}
                  setRelationTarget={setRelationTarget}
                  relationType={relationType}
                  setRelationType={setRelationType}
                  removeRel={(id) =>
                    persist(removeRelation(stateRef.current, id))
                  }
                />
              </div>
            </>
          )}
          {view === "graph" && (
            <>
              <div className="pageHead">
                <div>
                  <div className="eyebrow">VISUALIZE / CONNECTIONS</div>
                  <h1>
                    Knowledge graph<span>.</span>
                  </h1>
                  <p>
                    Every line is a relationship explicitly recorded in this
                    workspace.
                  </p>
                </div>
                <span className="pill">
                  {graphNodes.length} NODES / {graphEdges.length} LINKS
                </span>
              </div>
              <div className="toolbar">
                <label>
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search nodes…"
                  />
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  aria-label="Filter by type"
                >
                  <option value="">All types</option>
                  {[
                    "project",
                    "note",
                    "document",
                    "link",
                    "decision",
                    "session",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <span>SHOWING UP TO 150</span>
              </div>
              <div className="workspaceGrid">
                <section className="panel">
                  <div className="panelHead">
                    <div>
                      <div className="eyebrow">CONTEXT NETWORK</div>
                      <h2>Connected thinking</h2>
                    </div>
                  </div>
                  {graphNodes.length ? (
                    <div className="graph">
                      <ReactFlow
                        nodes={graphNodes}
                        edges={graphEdges}
                        onNodeClick={(_, n) => setActiveId(n.id)}
                        fitView
                        minZoom={0.15}
                        proOptions={{ hideAttribution: true }}
                      >
                        <Background color="#33343b" gap={22} />
                        <Controls />
                      </ReactFlow>
                    </div>
                  ) : (
                    <div className="empty">
                      No graph nodes yet. Create records and connect them.
                    </div>
                  )}
                  <div className="graphList">
                    {filtered.slice(0, 150).map((e) => (
                      <button key={e.id} onClick={() => setActiveId(e.id)}>
                        {typeLabel[e.type]} / {e.title}
                      </button>
                    ))}
                  </div>
                </section>
                <Inspector
                  entity={active}
                  state={state}
                  update={update}
                  onDelete={() => {}}
                  onOpen={open}
                  onRelate={() => {
                    if (active)
                      try {
                        persist(
                          addRelation(
                            stateRef.current,
                            active.id,
                            relationTarget,
                            relationType,
                          ),
                        );
                        setRelationTarget("");
                      } catch (e) {
                        setMessage(String(e));
                      }
                  }}
                  relationTarget={relationTarget}
                  setRelationTarget={setRelationTarget}
                  relationType={relationType}
                  setRelationType={setRelationType}
                  removeRel={(id) =>
                    persist(removeRelation(stateRef.current, id))
                  }
                  graph
                />
              </div>
            </>
          )}
          {view === "timeline" && (
            <>
              <div className="pageHead">
                <div>
                  <div className="eyebrow">YOUR RECORDED HISTORY</div>
                  <h1>
                    Timeline<span>.</span>
                  </h1>
                  <p>Only actions performed inside ContextOS are shown.</p>
                </div>
              </div>
              <div className="toolbar">
                <label>
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search recorded activity…"
                  />
                </label>
              </div>
              <section className="panel timeline">
                {state.activities
                  .filter(
                    (a) =>
                      !query ||
                      a.description.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((a) => (
                    <button
                      className="activityRow"
                      key={a.id}
                      onClick={() => {
                        const e = state.entities.find(
                          (x) => x.id === a.entityId,
                        );
                        if (e) open(e);
                      }}
                    >
                      <i />
                      <span>
                        <b>{a.description}</b>
                        <small>
                          {shortDate(a.at)} · {a.entityType}
                        </small>
                      </span>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                {!state.activities.length && (
                  <div className="empty">
                    Your recorded activity will appear here.
                  </div>
                )}
              </section>
            </>
          )}
          {view === "home" && active?.type === "session" && (
            <section className="panel sessionEditor">
              <div className="panelHead">
                <div>
                  <div className="eyebrow">SESSION INSPECTOR</div>
                  <h2>{active.title}</h2>
                </div>
                <button className="secondary" onClick={() => setActiveId("")}>
                  Close
                </button>
              </div>
              <label className="field">
                Session note
                <textarea
                  value={active.body}
                  onChange={(e) =>
                    update(active, { body: e.target.value }, "session updated")
                  }
                />
              </label>
              <label className="field">
                Next action
                <input
                  value={active.nextAction}
                  onChange={(e) =>
                    update(
                      active,
                      { nextAction: e.target.value },
                      "session updated",
                    )
                  }
                />
              </label>
              <div className="buttonGroup">
                <button
                  className="secondary"
                  onClick={() =>
                    update(active, { status: "active" }, "session resumed")
                  }
                >
                  Resume
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    update(active, { status: "ended" }, "session ended")
                  }
                >
                  End session
                </button>
                <span className="pill">{active.status}</span>
              </div>
            </section>
          )}
          {view === "settings" && (
            <section className="panel settings">
              <div className="eyebrow">LOCAL DATA / CONTROLS</div>
              <h1>
                Settings<span>.</span>
              </h1>
              <p>
                Your data stays on this device. This workspace does not monitor
                other apps, sync to a cloud, or send content to AI. Local
                storage is not encrypted.
              </p>
              <div className="setting">
                <div>
                  <b>Storage</b>
                  <p>
                    {repository?.label || "Unavailable"} ·{" "}
                    {state.entities.length} records
                  </p>
                </div>
                <Shield size={18} />
              </div>
              <div className="setting">
                <div>
                  <b>Backup and restore</b>
                  <p>
                    JSON includes records, relationships, and activity.
                    Restoring replaces the active workspace after confirmation.
                  </p>
                </div>
                <div className="buttonGroup">
                  <button className="secondary" onClick={exportBackup}>
                    Export JSON
                  </button>
                  <label className="secondary upload">
                    Choose backup
                    <input
                      type="file"
                      accept=".json"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          if (f.size > 20_000_000)
                            throw Error("Backup exceeds 20 MB");
                          setRestore(validateBackup(await f.text()));
                          setMessage(
                            "Backup validated. Review record count and confirm restore below.",
                          );
                        } catch (err) {
                          setRestore(null);
                          setMessage(`Backup rejected: ${String(err)}`);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
              {restore && (
                <div className="restore">
                  <b>
                    Validated backup: {restore.entities.length} records,{" "}
                    {restore.relations.length} relationships.
                  </b>
                  <button
                    className="primary"
                    onClick={() => {
                      if (
                        confirm(
                          "Replace the current workspace with this backup? Export a backup first if needed.",
                        )
                      ) {
                        persist(restore);
                        setRestore(null);
                        setActiveId("");
                        setMessage("Backup restored.");
                      }
                    }}
                  >
                    Replace workspace
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setRestore(null)}
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div className="setting">
                <div>
                  <b>Search index</b>
                  <p>
                    Search runs directly on current records, so there is no
                    separate index to rebuild. Semantic search is not enabled.
                  </p>
                </div>
              </div>
              <div className="setting">
                <div>
                  <b>Delete all local data</b>
                  <p>Export a backup before clearing the workspace.</p>
                </div>
                <button
                  className="danger"
                  onClick={() => {
                    if (
                      confirm(
                        "Permanently delete all records in this workspace?",
                      )
                    ) {
                      persist(emptyWorkspace());
                      setActiveId("");
                    }
                  }}
                >
                  <Trash2 size={15} /> Clear workspace
                </button>
              </div>
              <div className="setting">
                <div>
                  <b>Demo data</b>
                  <p>Synthetic examples are clearly labeled and removable.</p>
                </div>
                <button className="secondary" onClick={addDemo}>
                  Add demo
                </button>
              </div>
            </section>
          )}
        </main>
        <footer>
          CONTEXTOS <span>×</span> YOUR WORK HAS CONTEXT <span>×</span> LOCAL
          FIRST
        </footer>
      </div>
      {palette && (
        <div className="overlay" onClick={() => setPalette(false)}>
          <div
            className="palette"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onClick={(e) => e.stopPropagation()}
          >
            <label>
              <Search size={18} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your workspace…"
              />
            </label>
            <div className="paletteActions">
              <button
                onClick={() => {
                  setPalette(false);
                  setView("search");
                }}
              >
                Search all records ↗
              </button>
              <button
                onClick={() => {
                  setPalette(false);
                  create("note");
                }}
              >
                Create note
              </button>
              <button
                onClick={() => {
                  setPalette(false);
                  create("project");
                }}
              >
                Create project
              </button>
              <button
                onClick={() => {
                  setPalette(false);
                  setView("graph");
                }}
              >
                Open graph
              </button>
              <button
                onClick={() => {
                  setPalette(false);
                  setView("timeline");
                }}
              >
                Open timeline
              </button>
              <button
                onClick={() => {
                  setPalette(false);
                  exportBackup();
                }}
              >
                Export backup
              </button>
            </div>
            {query &&
              filtered.slice(0, 5).map((e) => (
                <button
                  className="paletteResult"
                  key={e.id}
                  onClick={() => {
                    setPalette(false);
                    open(e);
                  }}
                >
                  {typeLabel[e.type]} / {e.title}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
function Chevron() {
  return <span className="chevron">↗</span>;
}
function Inspector({
  entity,
  state,
  update,
  onDelete,
  onOpen,
  onRelate,
  relationTarget,
  setRelationTarget,
  relationType,
  setRelationType,
  removeRel,
  graph = false,
}: {
  entity: Entity | undefined;
  state: Workspace;
  update: (e: Entity, c: Partial<Entity>, action?: string) => void;
  onDelete: () => void;
  onOpen: (e: Entity) => void;
  onRelate: () => void;
  relationTarget: string;
  setRelationTarget: (s: string) => void;
  relationType: Relation["type"];
  setRelationType: (s: Relation["type"]) => void;
  removeRel: (id: string) => void;
  graph?: boolean;
}) {
  const [draft, setDraft] = useState<Entity | undefined>(entity);
  useEffect(() => setDraft(entity), [entity?.id, entity?.updatedAt]);
  if (!entity || !draft)
    return (
      <aside className="panel inspector">
        <div className="eyebrow">CONTEXT INSPECTOR</div>
        <h2>Choose a record</h2>
        <p>Select an item to view its details and connections.</p>
      </aside>
    );
  const projects = state.entities.filter(
    (e) => e.type === "project" && !e.archived,
  );
  const related = state.relations.filter(
    (r) => r.source === entity.id || r.target === entity.id,
  );
  const save = (changes: Partial<Entity>, action?: string) => update(entity, changes, action);
  return (
    <aside className="panel inspector">
      <div className="eyebrow">
        {typeLabel[entity.type]} / CONTEXT INSPECTOR
      </div>
      <div className="inspectorHead">
        <h2>{entity.title}</h2>
        <button
          onClick={() => save({ pinned: !entity.pinned })}
          aria-label="Toggle favorite"
        >
          <Star size={16} fill={entity.pinned ? "#ef663d" : "none"} />
        </button>
      </div>
      {graph && (
        <button className="textButton" onClick={() => onOpen(entity)}>
          Open source record ↗
        </button>
      )}
      <label className="field">
        Title
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          onBlur={() => {
            if (draft.title.trim() && draft.title !== entity.title)
              save({ title: draft.title.trim() });
            else setDraft(entity);
          }}
        />
      </label>
      <label className="field">
        {entity.type === "note" ? "Markdown content" : "Description / notes"}
        <textarea
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          onBlur={() => {
            if (draft.body !== entity.body) save({ body: draft.body });
          }}
        />
      </label>
      {entity.type !== "project" && (
        <label className="field">
          Project
          <select
            value={entity.projectId || ""}
            onChange={(e) => save({ projectId: e.target.value || null })}
          >
            <option value="">Unassigned</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {entity.type === "project" && (
        <>
          <label className="field">
            Objective
            <input
              value={draft.meta.objective || ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  meta: { ...draft.meta, objective: e.target.value },
                })
              }
              onBlur={() => save({ meta: draft.meta })}
            />
          </label>
          <label className="field">
            Status
            <select
              value={entity.status}
              onChange={(e) => save({ status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </label>
        </>
      )}
      {(entity.type === "project" || entity.type === "session") && (
        <label className="field">
          Next action
          <input
            value={draft.nextAction}
            onChange={(e) => setDraft({ ...draft, nextAction: e.target.value })}
            onBlur={() => {
              if (draft.nextAction !== entity.nextAction)
                save({ nextAction: draft.nextAction });
            }}
          />
        </label>
      )}
      {entity.type === "link" && (
        <>
          <label className="field">
            URL
            <input
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              onBlur={() => {
                if (safeUrl(draft.url)) save({ url: draft.url });
                else setDraft(entity);
              }}
            />
          </label>
          {safeUrl(entity.url) && (
            <a href={entity.url} target="_blank" rel="noreferrer">
              Open link ↗
            </a>
          )}
        </>
      )}
      {entity.type === "decision" && (
        <>
          <label className="field">
            Status
            <select
              value={entity.status}
              onChange={(e) => save({ status: e.target.value })}
            >
              {[
                "proposed",
                "accepted",
                "rejected",
                "superseded",
                "completed",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          {[
            "context",
            "choice",
            "alternatives",
            "rationale",
            "expected",
            "actual",
          ].map((k) => (
            <label className="field" key={k}>
              {k}
              <textarea
                value={draft.meta[k] || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    meta: { ...draft.meta, [k]: e.target.value },
                  })
                }
                onBlur={() => save({ meta: draft.meta })}
              />
            </label>
          ))}
        </>
      )}
      <label className="field">
        Tags (comma separated)
        <input
          value={draft.tags.join(", ")}
          onChange={(e) =>
            setDraft({
              ...draft,
              tags: e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
          onBlur={() => save({ tags: draft.tags })}
        />
      </label>
      <div className="connection">
        <h3>
          Connections <span>{related.length}</span>
        </h3>
        {related.map((r) => {
          const other = state.entities.find(
            (e) => e.id === (r.source === entity.id ? r.target : r.source),
          );
          return (
            <div className="connectionRow" key={r.id}>
              <button onClick={() => other && onOpen(other)}>
                {r.type} · {other?.title || "Unknown"}
              </button>
              <button
                onClick={() => {
                  if (confirm("Remove this relationship?")) removeRel(r.id);
                }}
                aria-label="Remove relationship"
              >
                ×
              </button>
            </div>
          );
        })}
        <select
          aria-label="Relationship type"
          value={relationType}
          onChange={(e) => setRelationType(e.target.value as Relation["type"])}
        >
          {relationTypes.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select
          aria-label="Related record"
          value={relationTarget}
          onChange={(e) => setRelationTarget(e.target.value)}
        >
          <option value="">Choose a record…</option>
          {state.entities
            .filter((e) => e.id !== entity.id)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {typeLabel[e.type]} · {e.title}
              </option>
            ))}
        </select>
        <button
          className="secondary full"
          disabled={!relationTarget}
          onClick={onRelate}
        >
          <Plus size={14} /> Add connection
        </button>
      </div>
      {entity.type === "note" && (
        <button
          className="textButton"
          onClick={() =>
            download(
              `${entity.title.replace(/[^a-z0-9]+/gi, "-") || "note"}.md`,
              entity.body,
              "text/markdown",
            )
          }
        >
          Export Markdown ↓
        </button>
      )}
      {!graph && (
        <div className="inspectorActions">
          {entity.type === "project" && (
            <button
              className="secondary"
              onClick={() =>
                save({ archived: !entity.archived }, entity.archived ? "project restored" : "project archived")
              }
            >
              {entity.archived ? 'Restore' : 'Archive'}
            </button>
          )}
          <button className="danger" onClick={onDelete}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </aside>
  );
}
