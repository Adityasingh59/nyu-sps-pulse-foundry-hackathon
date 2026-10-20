import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  FlaskConical,
  Globe2,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  MoreHorizontal,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Utensils,
  WandSparkles,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import type {
  ArtifactType,
  ArtifactVersion,
  Bootstrap,
  Comparison,
  Metrics,
  Opportunity,
  Query,
  QueryResult,
  Restaurant,
  Run,
  SourceSnapshot,
} from "../shared/types";

type Page =
  | "overview"
  | "questions"
  | "opportunities"
  | "content"
  | "measurement"
  | "restaurant";
const nav = [
  { id: "overview", name: "Overview", icon: LayoutDashboard },
  { id: "questions", name: "Question bank", icon: MessageSquareText },
  { id: "opportunities", name: "Opportunities", icon: Sparkles },
  { id: "content", name: "Content studio", icon: FileText },
  { id: "measurement", name: "Measurement", icon: TrendingUp },
] as const;
const date = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not yet run";
const percent = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n.toFixed(1))}%`;
const typeNames: Record<ArtifactType, string> = {
  faq: "Customer FAQ",
  about: "Restaurant copy",
  jsonld: "Restaurant structured data",
};
const targetAppearance = (result: QueryResult, targetId: string) => {
  const found = result.appearances.filter((a) => a.entityId === targetId);
  if (!found.length) return undefined;
  const positions = found
    .filter((a) => a.recommended && a.position != null)
    .map((a) => a.position!);
  return {
    ...found[0],
    mention: found.some((a) => a.mention),
    recommended: found.some((a) => a.recommended),
    ambiguous: found.some((a) => a.ambiguous),
    position: positions.length ? Math.min(...positions) : null,
  };
};
const factLabel = (field: string) =>
  (
    ({
      menuUrl: "Menu link",
      menuItems: "Menu examples",
      priceRange: "Price range",
      phone: "Phone",
      address: "Street address",
      cuisine: "Cuisine",
      hours: "Posted hours",
      name: "Public name",
      description: "Description",
    }) as Record<string, string>
  )[field] || field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
const sourceLabel = (source: SourceSnapshot) =>
  source.review?.status === "rejected"
    ? "Excluded source · see review note"
    : source.mode === "synthetic"
      ? "Synthetic source"
      : source.sourceKind === "manual" ||
          /^(Owner-|Manually entered|Profile review)/.test(source.title)
        ? "Manual input / review record"
        : source.scope === "competitor"
          ? `Competitor source · ${source.entityName || "observed restaurant"}`
          : source.status === "failed"
            ? "Retrieval failed"
            : "Collected source";
const modeName = (run?: Run) =>
  !run
    ? "No measurement yet"
    : run.mode === "live"
      ? "Live provider run"
      : "Synthetic example";
const isActive = (r?: Run) => r?.status === "running" || r?.status === "queued";
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await response
    .json()
    .catch(() => ({ error: "The server returned an unreadable response." }));
  if (!response.ok)
    throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}
const post = <T,>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });

export default function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [page, setPage] = useState<Page>("overview");
  const [restaurantId, setRestaurantId] = useState("");
  const [runId, setRunId] = useState("");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [detail, setDetail] = useState<QueryResult | null>(null);
  const [source, setSource] = useState<SourceSnapshot | null>(null);
  const [runModal, setRunModal] = useState(false);
  const [mode, setMode] = useState<"synthetic" | "live">("synthetic");
  const [questionFilter, setQuestionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedArtifact, setSelectedArtifact] = useState<string>("");
  const load = useCallback(async () => {
    const next = await api<Bootstrap>("/bootstrap");
    setData(next);
    setRestaurantId(
      (prev) =>
        prev ||
        next.preferredRestaurantId ||
        next.restaurants.find(
          (r) => !r.facts.some((f) => f.provenance === "synthetic"),
        )?.id ||
        next.demoRestaurantId ||
        next.restaurants[0]?.id ||
        "",
    );
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const restaurant = data?.restaurants.find((r) => r.id === restaurantId);
  const banks =
    data?.banks
      .filter((b) => b.restaurantId === restaurantId)
      .sort((a, b) => b.version - a.version) || [];
  const runs =
    data?.runs
      .filter((r) => r.restaurantId === restaurantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) || [];
  const run = runs.find((r) => r.id === runId) || runs[0];
  const bank = data?.banks.find((b) => b.id === run?.bankId) || banks[0];
  const latestBank = banks[0];
  const artifacts =
    data?.artifacts.filter((a) => a.restaurantId === restaurantId) || [];
  const sources =
    data?.sources.filter((s) => s.restaurantId === restaurantId) || [];
  const active = runs.some(isActive);
  const collecting = restaurant?.collectionStatus === "collecting";
  const collectingEvidence = run?.evidenceStatus === "collecting";
  useEffect(() => {
    if (!collecting) return;
    const timer = setInterval(
      () => load().catch((e) => setError(e.message)),
      2000,
    );
    return () => clearInterval(timer);
  }, [collecting, load]);
  useEffect(() => {
    setMode(
      restaurant?.facts.some((f) => f.provenance === "synthetic")
        ? "synthetic"
        : "live",
    );
  }, [restaurant?.id]);
  useEffect(() => {
    if (!active && !collectingEvidence) return;
    const timer = setInterval(
      () => load().catch((e) => setError(e.message)),
      850,
    );
    return () => clearInterval(timer);
  }, [active, collectingEvidence, load]);
  useEffect(() => {
    if (!run?.id) {
      setOpportunities([]);
      return;
    }
    let ignore = false;
    api<Opportunity[]>(`/runs/${run.id}/opportunities`)
      .then((result) => {
        if (!ignore) setOpportunities(result);
      })
      .catch((e) => {
        if (!ignore) setError(e.message);
      });
    return () => {
      ignore = true;
    };
  }, [run?.id, run?.status, run?.evidenceStatus, run?.analysisRevision, load]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDetail(null);
        setSource(null);
        setRunModal(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const execute = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy("");
    }
  };
  const startRun = () =>
    execute("run", async () => {
      if (!latestBank) throw new Error("Create a question bank first.");
      const next = await post<Run>("/runs", {
        bankId: latestBank.id,
        mode,
        idempotencyKey: crypto.randomUUID(),
      });
      await load();
      setRunId(next.id);
      setRunModal(false);
      setPage("overview");
      setNotice(
        "Analysis started. Progress is saved as each answer completes.",
      );
    });
  const rerun = () =>
    execute("rerun", async () => {
      if (!run) return;
      const next = await post<Run>(`/runs/${run.id}/rerun`, {
        idempotencyKey: crypto.randomUUID(),
      });
      await load();
      setRunId(next.id);
      setNotice(
        "Repeat measurement started with the saved questions and settings.",
      );
    });
  const generate = (opportunity: Opportunity, type: ArtifactType) =>
    execute(`generate-${opportunity.id}-${type}`, async () => {
      const artifact = await post<ArtifactVersion>(
        `/opportunities/${opportunity.id}/artifacts`,
        { type },
      );
      await load();
      setSelectedArtifact(artifact.id);
      setPage("content");
      setNotice(
        "Draft created from available profile facts. Review before using.",
      );
    });
  const changeRestaurant = (id: string) => {
    const selected = data?.restaurants.find((r) => r.id === id);
    setMode(
      selected?.facts.some((f) => f.provenance === "synthetic")
        ? "synthetic"
        : "live",
    );
    setRestaurantId(id);
    setRunId("");
    setSelectedArtifact("");
    setQuestionFilter("all");
  };
  const currentQueries = bank?.queries || [];
  const results = (run?.results || []).filter((r) => {
    const q = currentQueries.find((q) => q.id === r.queryId);
    const appearance = targetAppearance(r, restaurantId);
    if (questionFilter === "mentioned" && !appearance?.mention) return false;
    if (
      questionFilter === "missed" &&
      (r.status !== "succeeded" || appearance?.mention)
    )
      return false;
    if (questionFilter === "failed" && r.status !== "failed") return false;
    return !search || q?.text.toLowerCase().includes(search.toLowerCase());
  });
  if (!data)
    return (
      <div className="loading-screen">
        <div className="brand-mark">
          <Utensils size={24} />
        </div>
        <h1>TableSignal</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button
              className="button primary"
              onClick={() => load().catch((e) => setError(e.message))}
            >
              Try again
            </button>
          </>
        ) : (
          <p>
            <LoaderCircle className="spin" size={16} /> Opening your workspace…
          </p>
        )}
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPage("overview");
          }}
          aria-label="TableSignal home"
        >
          <span className="brand-mark">
            <Utensils size={21} />
          </span>
          TableSignal<span className="brand-period">.</span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <div className="restaurant-switch">
          <span className="restaurant-monogram">
            {restaurant?.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("") || "+"}
          </span>
          <div>
            <strong>{restaurant?.name || "Your restaurant"}</strong>
            <span>
              {restaurant?.location.split(",")[0] || "Set up your profile"}
            </span>
          </div>
          <ChevronDown size={15} />
          <select
            aria-label="Choose restaurant"
            value={restaurantId}
            onChange={(e) => changeRestaurant(e.target.value)}
          >
            {data.restaurants.map((r) => (
              <option value={r.id} key={r.id}>
                {r.name}
                {r.facts.some((f) => f.provenance === "synthetic")
                  ? " · fictional example"
                  : " · public profile"}
              </option>
            ))}
          </select>
        </div>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}
            >
              <item.icon size={19} />
              <span>{item.name}</span>
              {item.id === "opportunities" && opportunities.length > 0 ? (
                <span className="nav-count">{opportunities.length}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="small-spark">
            <Sparkles size={18} />
          </span>
          <strong>Good food. Better discovered.</strong>
          <p>A clearer picture of how AI talks about your restaurant.</p>
          <button onClick={() => setRunModal(true)}>
            Explore your visibility <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${page === "restaurant" ? "active" : ""}`}
            onClick={() => setPage("restaurant")}
          >
            <Settings2 size={18} />
            Restaurant settings
          </button>
          <div className="operator">
            <span className="avatar">YO</span>
            <div>
              <strong>Your workspace</strong>
              <span>Local development</span>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <span>
              {page === "restaurant"
                ? "Restaurant settings"
                : nav.find((n) => n.id === page)?.name}
            </span>
          </div>
          <div className="topbar-right">
            <span className={`mode-pill ${run?.mode === "live" ? "live" : ""}`}>
              <span className="status-dot" />
              {modeName(run)}
            </span>
            <button
              className="icon-button help"
              aria-label="About this workspace"
              onClick={() =>
                setNotice(
                  "TableSignal measures a defined question set. Results are snapshots and do not represent a universal AI ranking.",
                )
              }
            >
              <CircleHelp size={19} />
            </button>
            <span className="top-avatar">YO</span>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="alert error" role="alert">
              <XCircle size={18} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={17} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "overview"
                  ? "YOUR DISCOVERY, DECODED"
                  : page === "questions"
                    ? "START WITH THE RIGHT QUESTIONS"
                    : page === "opportunities"
                      ? "FROM OBSERVATION TO ACTION"
                      : page === "content"
                        ? "MAKE YOUR NEXT MOVE"
                        : page === "measurement"
                          ? "REPEAT. COMPARE. LEARN."
                          : "THE FACTS COME FIRST"}
              </div>
              <h1>
                {page === "overview"
                  ? "A seat at the AI table."
                  : page === "questions"
                    ? "What are diners asking?"
                    : page === "opportunities"
                      ? "Small changes. Clearer signals."
                      : page === "content"
                        ? "Your content, ready to work."
                        : page === "measurement"
                          ? "See what actually changes."
                          : "Get to know your restaurant."}
              </h1>
              <p>
                {page === "overview"
                  ? "See where your restaurant shows up, who appears alongside it, and what to do next."
                  : page === "questions"
                    ? "A repeatable set of real-world dining questions, without your restaurant name in the prompt."
                    : page === "opportunities"
                      ? "Evidence-backed ideas you can review, understand, and act on."
                      : page === "content"
                        ? "Create useful drafts from known facts. Review, edit, and take them with you."
                        : page === "measurement"
                          ? "Compare the same questions and settings. An unchanged result is still a useful result."
                          : "Keep a confirmed profile so every generated claim has a place to come from."}
              </p>
            </div>
            <div className="heading-action">
              {page === "overview" || page === "questions" ? (
                <button
                  className="button primary"
                  disabled={!!busy || active || !latestBank}
                  onClick={() =>
                    restaurant?.confirmedAt
                      ? setRunModal(true)
                      : setPage("restaurant")
                  }
                >
                  {active ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Zap size={16} />
                  )}{" "}
                  {active
                    ? "Analysis in progress"
                    : restaurant?.confirmedAt
                      ? "Run analysis"
                      : "Confirm restaurant"}
                  <ArrowUpRight size={16} />
                </button>
              ) : page === "measurement" ? (
                <button
                  className="button primary"
                  disabled={!!busy || active || !run}
                  onClick={rerun}
                >
                  <RefreshCw
                    size={16}
                    className={busy === "rerun" ? "spin" : ""}
                  />
                  Repeat this measurement
                </button>
              ) : null}
            </div>
          </div>
          {page !== "restaurant" && (
            <div className="context-banner">
              {run?.mode === "synthetic" ? (
                <FlaskConical size={18} />
              ) : (
                <Globe2 size={18} />
              )}
              <div>
                {!run ? (
                  <>
                    <strong>Research starts with public evidence.</strong>{" "}
                    Review the restaurant’s source snapshots and confirm its
                    identity before measuring recommendations.
                  </>
                ) : run.mode === "live" ? (
                  <>
                    <strong>Live provider measurement.</strong> Results reflect
                    this saved provider configuration, not a consumer chat app.
                  </>
                ) : (
                  <>
                    <strong>You’re exploring a synthetic example.</strong>{" "}
                    {restaurant?.facts.some((f) => f.provenance === "synthetic")
                      ? "Answers, restaurant facts, and source excerpts are fictional demo data."
                      : "Answers are synthetic demonstration data. Restaurant facts retain their recorded source provenance."}
                  </>
                )}
              </div>
              <button onClick={() => setPage("restaurant")}>
                View restaurant <ArrowRight size={14} />
              </button>
            </div>
          )}
          {run && page !== "restaurant" && (
            <div className="run-context">
              <span>
                <span className="tiny-dot" />
                {restaurant?.name}
              </span>
              <span>
                {run.provider} · {run.model}
              </span>
              <span>{date(run.createdAt)}</span>
              <span>
                {run.mode === "live" ? "Live web search" : "Synthetic fixtures"}
              </span>
              {run.parsedAt && (
                <span>
                  Extraction reviewed · revision {run.analysisRevision || 1}
                </span>
              )}
              {run.status !== "queued" && run.status !== "running" && (
                <a className="text-link" href={`/api/runs/${run.id}/report`}>
                  <ArrowDownToLine size={12} />
                  Download evidence report
                </a>
              )}
              {runs.length > 1 && (
                <select
                  aria-label="Select analysis run"
                  value={run.id}
                  onChange={(e) => setRunId(e.target.value)}
                >
                  {runs.map((r, i) => (
                    <option key={r.id} value={r.id}>
                      {i === 0 ? "Latest · " : ""}
                      {date(r.createdAt)} · {r.status}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {collectingEvidence && (
            <section className="progress-panel" role="status">
              <div>
                <LoaderCircle size={17} className="spin" />
                <strong>Inspecting observed competitors</strong>
              </div>
              <p>
                Collecting a bounded set of provider-cited public pages for the
                leading observed restaurants. Sources and retrieval failures are
                saved.
              </p>
            </section>
          )}
          {run?.evidenceWarnings?.length ? (
            <div className="evidence-warnings">
              <CircleHelp size={16} />
              <div>
                {run.evidenceWarnings.map((warning, i) => (
                  <p key={i}>{warning}</p>
                ))}
              </div>
            </div>
          ) : null}
          {active && run && (
            <section className="progress-panel" aria-live="polite">
              <div>
                <LoaderCircle className="spin" size={18} />
                <strong>Listening to the answers</strong>
                <span>
                  {
                    run.results.filter(
                      (r) => r.status === "succeeded" || r.status === "failed",
                    ).length
                  }{" "}
                  of {run.results.length} questions processed
                </span>
              </div>
              <div className="progress-track">
                <span
                  style={{
                    width: `${run.results.length ? (100 * run.results.filter((r) => ["succeeded", "failed"].includes(r.status)).length) / run.results.length : 0}%`,
                  }}
                />
              </div>
              <p>You can explore the workspace while we save each result.</p>
            </section>
          )}
          {run?.results.some((r) => r.status === "failed") &&
            !isActive(run) &&
            page === "overview" && (
              <div className="failure-banner">
                <XCircle size={17} />
                <div>
                  <strong>
                    {run.results.filter((r) => r.status === "failed").length}{" "}
                    answers could not be completed.
                  </strong>
                  <span>
                    They are excluded from visibility metrics. Open an answer to
                    inspect its error.
                  </span>
                </div>
                <button
                  className="button secondary small"
                  disabled={!!busy}
                  onClick={() =>
                    execute("retry", async () => {
                      await post(`/runs/${run.id}/retry-failed`);
                      await load();
                      setNotice(
                        "Retry started for eligible failed answers. Completed answers are preserved.",
                      );
                    })
                  }
                >
                  <RefreshCw
                    size={14}
                    className={busy === "retry" ? "spin" : ""}
                  />
                  Retry failed answers
                </button>
              </div>
            )}
          {page === "overview" && (
            <>
              {!run ? (
                <Empty
                  icon={Search}
                  title="Your first measurement starts here"
                  description="Confirm your restaurant, create a question bank, then run an analysis."
                  action={
                    <button
                      className="button primary"
                      onClick={() => setPage("restaurant")}
                    >
                      Set up restaurant <ArrowRight size={16} />
                    </button>
                  }
                />
              ) : (
                <>
                  <div className="section-heading compact">
                    <h2>
                      Visibility at a glance{" "}
                      <span className="muted-dot">·</span>
                      <span className="heading-sub">
                        {bank?.queries.filter((q) => !q.branded).length || 0}{" "}
                        discovery questions
                      </span>
                    </h2>
                    <span className="snapshot-label">
                      <Clock3 size={13} /> Single-run snapshot
                    </span>
                  </div>
                  <div className="metric-grid">
                    <Metric
                      label="Mention rate"
                      value={percent(run.metrics?.mentionRate)}
                      icon={MessageSquareText}
                      featured
                      detail={`${run.metrics?.mentions ?? 0} of ${run.metrics?.valid ?? 0} valid answers mention you`}
                      foot="Includes passing mentions"
                    />
                    <Metric
                      label="Recommendation rate"
                      value={percent(run.metrics?.recommendationRate)}
                      icon={Target}
                      detail={`${run.metrics?.recommendations ?? 0} of ${run.metrics?.valid ?? 0} valid answers recommend you`}
                      foot="A mention isn’t always a recommendation"
                    />
                    <Metric
                      label="Avg. observed position"
                      value={
                        run.metrics?.averagePosition == null
                          ? "—"
                          : `#${run.metrics.averagePosition.toFixed(1)}`
                      }
                      icon={ListFilter}
                      detail={`Across ${run.metrics?.positionSamples ?? 0} explicit list appearances`}
                      foot="Only ordered recommendations"
                    />
                    <Metric
                      label="Completion coverage"
                      value={percent(run.metrics?.coverage)}
                      icon={CheckCircle2}
                      detail={`${run.metrics?.valid ?? 0} valid / ${run.metrics?.attempted ?? 0} attempted`}
                      foot={`${run.metrics?.excludedAmbiguous ?? 0} ambiguous results excluded`}
                    />
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel competitor-panel">
                      <div className="panel-heading">
                        <div>
                          <div className="eyebrow">
                            THE RECOMMENDATION LANDSCAPE
                          </div>
                          <h2>Who’s getting a seat?</h2>
                          <p>
                            Share of all restaurant recommendations in this run.
                          </p>
                        </div>
                        <span className="subtle-icon">
                          <Utensils size={18} />
                        </span>
                      </div>
                      <Competitors run={run} restaurantId={restaurantId} />
                      <div className="panel-foot">
                        <span>
                          <span className="legend-dot target" />
                          {restaurant?.name}
                        </span>
                        <span>
                          <span className="legend-dot other" />
                          Observed competitors
                        </span>
                        <span>
                          {run.metrics?.totalRecommendationAppearances || 0}{" "}
                          total appearances
                        </span>
                      </div>
                    </section>
                    <section className="panel opportunities-preview">
                      <div className="panel-heading">
                        <div>
                          <div className="eyebrow">YOUR NEXT BEST MOVES</div>
                          <h2>A little clarity goes a long way.</h2>
                        </div>
                        <span className="sparkle-orb">
                          <Sparkles size={20} />
                        </span>
                      </div>
                      {opportunities.length ? (
                        opportunities.slice(0, 3).map((op, i) => (
                          <button
                            className="op-preview"
                            key={op.id}
                            onClick={() => setPage("opportunities")}
                          >
                            <span className="op-number">0{i + 1}</span>
                            <span>
                              <strong>{op.title}</strong>
                              <span>
                                {op.effort} effort{" "}
                                <span className="text-dot">·</span>{" "}
                                {op.sourceIds.length} source
                                {op.sourceIds.length !== 1 ? "s" : ""}
                              </span>
                            </span>
                            <ArrowUpRight size={17} />
                          </button>
                        ))
                      ) : (
                        <div className="inline-empty">
                          Findings appear when source evidence and completed
                          answers are available.
                        </div>
                      )}
                      <button
                        className="text-link preview-link"
                        onClick={() => setPage("opportunities")}
                      >
                        Explore opportunities <ArrowRight size={15} />
                      </button>
                    </section>
                  </div>
                  <section className="panel query-panel">
                    <div className="panel-heading">
                      <div>
                        <div className="eyebrow">BEHIND THE NUMBERS</div>
                        <h2>The questions. The answers.</h2>
                        <p>Open any answer to see exactly what was said.</p>
                      </div>
                      <span className="count-label">
                        {currentQueries.length} questions
                      </span>
                    </div>
                    <div className="table-toolbar">
                      <div className="tabs">
                        {[
                          ["all", "All questions"],
                          ["mentioned", "Mentioned"],
                          ["missed", "Not mentioned"],
                          ["failed", "Failed"],
                        ].map(([id, label]) => (
                          <button
                            key={id}
                            onClick={() => setQuestionFilter(id)}
                            className={questionFilter === id ? "selected" : ""}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="search-input">
                        <Search size={15} />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Find a question…"
                          aria-label="Search questions"
                        />
                      </div>
                    </div>
                    <div className="table-scroll">
                      <table className="results-table">
                        <thead>
                          <tr>
                            <th>Customer question</th>
                            <th>Intent</th>
                            <th>Your presence</th>
                            <th>Position</th>
                            <th>
                              <span className="sr-only">Inspect answer</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((r) => {
                            const q = currentQueries.find(
                              (q) => q.id === r.queryId,
                            );
                            const a = targetAppearance(r, restaurantId);
                            return (
                              <tr key={r.id}>
                                <td>
                                  <button
                                    className="question-link"
                                    onClick={() => setDetail(r)}
                                  >
                                    {q?.text || "Question unavailable"}
                                    {q?.branded && (
                                      <span className="tag">
                                        Branded · excluded
                                      </span>
                                    )}
                                  </button>
                                </td>
                                <td>
                                  <span className="intent-tag">
                                    {q?.intents[0] || "General"}
                                  </span>
                                </td>
                                <td>
                                  <Presence
                                    result={r}
                                    targetId={restaurantId}
                                  />
                                </td>
                                <td className="position">
                                  {a?.recommended && a.position != null
                                    ? `#${a.position}`
                                    : "—"}
                                </td>
                                <td>
                                  <button
                                    className="icon-button"
                                    aria-label={`Inspect answer for ${q?.text}`}
                                    onClick={() => setDetail(r)}
                                  >
                                    <ArrowUpRight size={17} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {results.length === 0 && (
                        <div className="inline-empty">
                          No results match this filter.
                        </div>
                      )}
                    </div>
                    <div className="table-foot">
                      <ShieldCheck size={14} /> Failed answers never count as
                      “not mentioned.” Positions apply only to explicit
                      recommendation lists.
                    </div>
                  </section>
                </>
              )}
            </>
          )}
          {page === "questions" && (
            <QuestionWorkspace
              bank={latestBank}
              restaurant={restaurant}
              busy={busy}
              onSave={(queries) =>
                execute("questions", async () => {
                  if (!restaurant) return;
                  await post(`/restaurants/${restaurant.id}/query-banks`, {
                    queries,
                  });
                  await load();
                  setNotice(
                    "New question bank saved. Existing runs keep their original version.",
                  );
                })
              }
            />
          )}
          {page === "opportunities" && (
            <div className="opportunity-list">
              {opportunities.length ? (
                opportunities.map((op, i) => (
                  <section className="panel opportunity-card" key={op.id}>
                    <div className="opportunity-top">
                      <span className="op-number large">0{i + 1}</span>
                      <div>
                        <div className="chip-row">
                          <span className="tag green">
                            Priority {op.priority}
                          </span>
                          <span className="tag">{op.effort} effort</span>
                          {op.intents.map((t) => (
                            <span className="tag" key={t}>
                              {t}
                            </span>
                          ))}
                        </div>
                        <h2>{op.title}</h2>
                        <p>{op.gap}</p>
                      </div>
                    </div>
                    <div className="finding-grid">
                      <div>
                        <h3>
                          <Search size={15} /> What we observed
                        </h3>
                        <p>{op.competitorExample || op.rationale}</p>
                        <div className="source-links">
                          {op.sourceIds.map((id) => {
                            const s = data.sources.find((s) => s.id === id);
                            return (
                              s && (
                                <button key={id} onClick={() => setSource(s)}>
                                  <FileText size={13} />
                                  {s.title}
                                  <ArrowUpRight size={13} />
                                </button>
                              )
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <h3>
                          <WandSparkles size={15} /> A practical next step
                        </h3>
                        <p>{op.action}</p>
                        <div className="artifact-actions">
                          {op.artifactTypes.map((type) => (
                            <button
                              className={
                                type === "faq"
                                  ? "button primary small"
                                  : "button secondary small"
                              }
                              key={type}
                              disabled={!!busy}
                              onClick={() => generate(op, type)}
                            >
                              {busy === `generate-${op.id}-${type}` ? (
                                <LoaderCircle size={14} className="spin" />
                              ) : (
                                <Plus size={14} />
                              )}
                              Create{" "}
                              {type === "jsonld"
                                ? "structured data"
                                : type === "faq"
                                  ? "FAQ"
                                  : "copy"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="uncertainty">
                      <CircleHelp size={15} />
                      <p>
                        <strong>What this can tell us:</strong> {op.uncertainty}
                      </p>
                    </div>
                  </section>
                ))
              ) : (
                <Empty
                  icon={Sparkles}
                  title="Evidence comes before recommendations"
                  description="Complete an analysis and collect source evidence to see supported opportunities."
                  action={
                    <button
                      className="button secondary"
                      onClick={() => setPage("overview")}
                    >
                      Back to overview
                    </button>
                  }
                />
              )}
            </div>
          )}
          {page === "content" && (
            <ContentWorkspace
              artifacts={artifacts}
              runs={runs}
              selectedId={selectedArtifact}
              onSelect={setSelectedArtifact}
              sources={data.sources}
              onSource={setSource}
              busy={busy}
              onSave={(artifact, content) =>
                execute("save-artifact", async () => {
                  const next = await api<ArtifactVersion>(
                    `/artifacts/${artifact.id}`,
                    { method: "PATCH", body: JSON.stringify({ content }) },
                  );
                  await load();
                  setSelectedArtifact(next.id);
                  setNotice("New artifact version saved.");
                })
              }
              onBrowse={() => setPage("opportunities")}
              notify={setNotice}
            />
          )}
          {page === "measurement" && (
            <Measurement
              runs={runs}
              artifacts={artifacts}
              banks={data.banks}
              onError={setError}
            />
          )}
          {page === "restaurant" && (
            <RestaurantSetup
              restaurant={restaurant}
              sources={sources}
              allSources={data.sources}
              onSource={setSource}
              provider={data.provider}
              onRefresh={() =>
                execute("refresh-evidence", async () => {
                  if (!restaurant) return;
                  await post(`/restaurants/${restaurant.id}/collect-sources`);
                  await load();
                  setNotice(
                    "Collecting public pages. New source snapshots and draft facts will appear as they are saved.",
                  );
                })
              }
              collecting={collecting}
              busy={busy}
              onCreate={(form) =>
                execute("restaurant", async () => {
                  const next = await post<Restaurant>("/restaurants", form);
                  await post(`/restaurants/${next.id}/query-banks`);
                  await load();
                  changeRestaurant(next.id);
                  setNotice(
                    "Restaurant and question bank saved. Collection runs in the background.",
                  );
                })
              }
              onConfirm={(factIndexes) =>
                execute("confirm", async () => {
                  if (!restaurant) return;
                  await api(`/restaurants/${restaurant.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      confirmed: true,
                      factIndexes,
                    }),
                  });
                  await load();
                  setNotice(
                    factIndexes?.length
                      ? "Selected source facts accepted. Original provenance is preserved."
                      : "Restaurant identity confirmed. Source facts retain their review status.",
                  );
                })
              }
            />
          )}
          <footer className="page-footer">
            <span>
              TableSignal <span className="text-dot">·</span> Better
              information. Better decisions.
            </span>
            <span>Built for the restaurant behind the recommendation.</span>
          </footer>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {detail && (
        <Dialog
          title="Inside the answer"
          subtitle={currentQueries.find((q) => q.id === detail.queryId)?.text}
          onClose={() => setDetail(null)}
          wide
        >
          <div className="detail-meta">
            <span className="mode-pill">
              <FlaskConical size={13} />
              {modeName(run)}
            </span>
            <span>
              {run?.provider} / {run?.model}
            </span>
            <span>{date(detail.executedAt)}</span>
          </div>
          <div className="answer-summary">
            <Presence result={detail} targetId={restaurantId} />
            <span>
              {detail.latencyMs != null
                ? `${(detail.latencyMs / 1000).toFixed(2)}s latency`
                : "Latency unavailable"}
            </span>
            <span>
              {detail.attempts} attempt{detail.attempts !== 1 ? "s" : ""}
            </span>
          </div>
          {detail.error && (
            <div className="alert error">
              <XCircle size={16} />
              {detail.error}
            </div>
          )}
          <h3 className="drawer-label">Original answer</h3>
          <pre className="raw-answer">
            {detail.rawAnswer || "No completed answer is available."}
          </pre>
          <h3 className="drawer-label">Extracted restaurant appearances</h3>
          <div className="appearances">
            {detail.appearances.length ? (
              detail.appearances.map((a, i) => (
                <div key={`${a.entityId}-${i}`}>
                  <div>
                    <strong>{a.name}</strong>
                    <span>
                      {a.ambiguous
                        ? "Ambiguous identity · excluded"
                        : a.recommended
                          ? "Recommended"
                          : "Mentioned in passing"}
                      {a.position != null ? ` · position #${a.position}` : ""}
                    </span>
                  </div>
                  <blockquote>{a.evidenceSpan}</blockquote>
                </div>
              ))
            ) : (
              <p>No restaurant appearances were extracted.</p>
            )}
          </div>
          <h3 className="drawer-label">Answer citations</h3>
          {detail.citations.length ? (
            detail.citations.map((c, i) => (
              <a
                className="citation"
                key={`${c.url}-${i}`}
                href={safeUrl(c.url)}
                target="_blank"
                rel="noreferrer"
              >
                {c.title}
                <ExternalLink size={13} />
              </a>
            ))
          ) : (
            <p className="muted">
              Citations unavailable
              {run?.mode === "synthetic" ? " for this synthetic example" : ""}.
            </p>
          )}
          <p className="small-note">
            Mention presence and recommendation presence are measured
            separately. Positions reflect explicit list order.
          </p>
        </Dialog>
      )}
      {source && (
        <Dialog
          title="Source evidence"
          subtitle={source.title}
          onClose={() => setSource(null)}
        >
          <div className="detail-meta">
            <span className="mode-pill">
              <FlaskConical size={13} />
              {sourceLabel(source)}
            </span>
            <span>{date(source.fetchedAt)}</span>
          </div>
          <p className="source-url">
            {source.mode === "synthetic" ? (
              <>
                <Globe2 size={15} />
                {source.url}
              </>
            ) : (
              <a href={safeUrl(source.url)} target="_blank" rel="noreferrer">
                {source.url}
                <ExternalLink size={13} />
              </a>
            )}
          </p>
          {source.status === "failed" ? (
            <div className="alert error">
              Could not retrieve this source. {source.error} This does not show
              that information is absent.
            </div>
          ) : (
            <pre className="raw-answer">{source.excerpt}</pre>
          )}
          {source.schemaTypes && (
            <div className="source-inspection">
              <h3 className="drawer-label">Structured data inspection</h3>
              <p>
                {source.schemaTypes.length
                  ? `Observed schema types: ${source.schemaTypes.join(", ")}`
                  : "No recognized schema types in this inspected snapshot."}
              </p>
              {source.schemaIssues?.map((issue, i) => (
                <p key={i}>{issue}</p>
              ))}
              {source.contentTruncated && (
                <p>
                  Saved display text was truncated; absence findings require
                  caution.
                </p>
              )}
            </div>
          )}
          {source.review && (
            <div
              className={`alert ${source.review.status === "rejected" ? "error" : ""}`}
            >
              <CircleHelp size={16} />
              <span>
                {source.review.status === "rejected"
                  ? "Excluded from analysis"
                  : "Reviewed source"}
                : {source.review.reason}
              </span>
            </div>
          )}
          <h3 className="drawer-label">Snapshot fingerprint</h3>
          <code className="hash">
            {source.contentHash || "No content hash available"}
          </code>
          <p className="small-note">
            {source.mode === "synthetic"
              ? "This fictional excerpt illustrates evidence inspection. It is not a retrieved public page."
              : source.sourceKind === "manual" ||
                  /^(Owner-|Manually entered|Profile review)/.test(source.title)
                ? "This snapshot records manual input or an operator review. It is not independent public website evidence and does not assert ownership."
                : "Findings apply only to this inspected snapshot. A fetch failure is not evidence of absence."}
          </p>
        </Dialog>
      )}
      {runModal && (
        <Dialog
          title="Start a visibility analysis"
          subtitle="A defined test set. Saved answers. A repeatable snapshot."
          onClose={() => setRunModal(false)}
        >
          <div className="analysis-summary">
            <span className="restaurant-monogram light">
              {restaurant?.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{restaurant?.name}</strong>
              <span>{restaurant?.location}</span>
            </div>
          </div>
          <label
            className={`mode-option ${mode === "synthetic" ? "chosen" : ""} ${!restaurant?.facts.some((f) => f.provenance === "synthetic") ? "disabled" : ""}`}
          >
            <input
              type="radio"
              name="run-mode"
              checked={mode === "synthetic"}
              disabled={
                !restaurant?.facts.some((f) => f.provenance === "synthetic")
              }
              onChange={() => setMode("synthetic")}
            />
            <span>
              <strong>
                <FlaskConical size={16} />
                Synthetic example
              </strong>
              <span>
                {restaurant?.facts.some((f) => f.provenance === "synthetic")
                  ? "Fictional answers for exploring the workflow. Repeat runs use the same fixture and may be unchanged."
                  : "Available in the separate fictional restaurant example. Real restaurant profiles use live measurement."}
              </span>
            </span>
          </label>
          <label
            className={`mode-option ${mode === "live" ? "chosen" : ""} ${!data.provider.configured || restaurant?.facts.some((f) => f.provenance === "synthetic") ? "disabled" : ""}`}
          >
            <input
              type="radio"
              name="run-mode"
              checked={mode === "live"}
              disabled={
                !data.provider.configured ||
                restaurant?.facts.some((f) => f.provenance === "synthetic")
              }
              onChange={() => setMode("live")}
            />
            <span>
              <strong>
                <Globe2 size={16} />
                Live provider run
              </strong>
              <span>
                {restaurant?.facts.some((f) => f.provenance === "synthetic")
                  ? "Add and confirm a real restaurant profile to use live measurements."
                  : data.provider.configured
                    ? `${data.provider.name || data.provider.adapter || "Connected provider"} · ${data.provider.model}`
                    : data.provider.status ||
                      "A working, authenticated provider connection is required to run a real measurement."}
              </span>
            </span>
          </label>
          <div
            className={`provider-status ${data.provider.configured ? "connected" : "unavailable"}`}
          >
            <span
              className={`tag ${data.provider.configured ? "green" : "amber"}`}
            >
              {data.provider.configured ? (
                <CheckCircle2 size={13} />
              ) : (
                <CircleHelp size={13} />
              )}
              {data.provider.configured
                ? "Provider connected"
                : "Provider unavailable"}
            </span>
            <strong>
              {data.provider.name ||
                data.provider.adapter ||
                "Live measurement provider"}
            </strong>
            <p>
              {data.provider.status ||
                (data.provider.configured
                  ? `${data.provider.model} · independent sessions with saved settings`
                  : "Provider authentication has not been verified.")}
            </p>
            {!restaurant?.facts.some((f) => f.provenance === "synthetic") &&
              data.demoRestaurantId && (
                <button
                  className="text-link"
                  onClick={() => {
                    changeRestaurant(data.demoRestaurantId);
                    setRunModal(false);
                  }}
                >
                  Open the fictional example <ArrowRight size={13} />
                </button>
              )}
          </div>
          <div className="analysis-facts">
            <div>
              <span>Question bank</span>
              <strong>
                Version {latestBank?.version} · {latestBank?.queries.length}{" "}
                questions
              </strong>
            </div>
            <div>
              <span>Question identity</span>
              <strong>Independent, non-branded discovery</strong>
            </div>
            <div>
              <span>Storage</span>
              <strong>Saved locally as each result completes</strong>
            </div>
          </div>
          <button
            className="button primary full"
            onClick={startRun}
            disabled={
              !!busy ||
              active ||
              !latestBank ||
              !restaurant?.confirmedAt ||
              (mode === "live" && !data.provider.configured) ||
              (mode === "synthetic" &&
                !restaurant?.facts.some((f) => f.provenance === "synthetic"))
            }
          >
            {busy === "run" ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Zap size={16} />
            )}
            Start {mode === "synthetic" ? "synthetic" : "live"} analysis
            <ArrowRight size={16} />
          </button>
        </Dialog>
      )}
    </div>
  );
}

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
function Metric({
  label,
  value,
  detail,
  foot,
  icon: Icon,
  featured = false,
}: {
  label: string;
  value: string;
  detail: string;
  foot: string;
  icon: typeof Target;
  featured?: boolean;
}) {
  return (
    <section className={`metric-card ${featured ? "featured" : ""}`}>
      <div className="metric-label">
        {label}
        <Icon size={17} />
      </div>
      <div className="metric-value">{value}</div>
      <p>{detail}</p>
      <div className="metric-foot">
        {featured ? (
          <span className="mini-line">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        ) : (
          <span className="metric-foot-dot" />
        )}
        {foot}
      </div>
    </section>
  );
}
function Presence({
  result,
  targetId,
}: {
  result: QueryResult;
  targetId: string;
}) {
  const a = targetAppearance(result, targetId);
  if (result.status === "queued" || result.status === "running")
    return (
      <span className="presence pending">
        <Clock3 size={12} />
        {result.status === "running" ? "Running" : "Queued"}
      </span>
    );
  if (result.status === "failed" || result.status === "cancelled")
    return (
      <span className="presence failed">
        <XCircle size={12} />
        {result.status === "failed" ? "Failed" : "Cancelled"}
      </span>
    );
  if (a?.ambiguous)
    return (
      <span className="presence pending">
        <CircleHelp size={12} />
        Needs review
      </span>
    );
  return a?.mention ? (
    <span className={`presence ${a.recommended ? "yes" : "incidental"}`}>
      <Check size={12} />
      {a.recommended ? "Recommended" : "Mentioned"}
    </span>
  ) : (
    <span className="presence no">
      <span />
      Not mentioned
    </span>
  );
}
function Competitors({
  run,
  restaurantId,
}: {
  run: Run;
  restaurantId: string;
}) {
  const target = run.competitors.find((c) => c.entityId === restaurantId);
  const chosen = run.competitors
    .filter((c) => c.entityId !== restaurantId)
    .slice(0, 3);
  const displayed = [...(target ? [target] : []), ...chosen].sort(
    (a, b) => b.appearances - a.appearances,
  );
  const remaining = run.competitors.filter(
    (c) => !displayed.some((d) => d.entityId === c.entityId),
  );
  const others = remaining.reduce((s, c) => s + c.shareOfVoice, 0);
  const all =
    others > 0
      ? [
          ...displayed,
          {
            entityId: "others",
            name: `Other restaurants (${remaining.length})`,
            appearances: remaining.reduce((s, c) => s + c.appearances, 0),
            shareOfVoice: others,
            averagePosition: null,
            isTarget: false,
          },
        ]
      : displayed;
  return (
    <div className="competitor-list">
      {all.length ? (
        all.map((c, i) => (
          <div
            className={`competitor-row ${c.isTarget ? "is-target" : ""}`}
            key={c.entityId}
          >
            <div className="competitor-name">
              <span className="competitor-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <strong>{c.name}</strong>
              {c.isTarget && <span className="you-tag">YOU</span>}
              <span>{c.appearances} mentions in recommendations</span>
            </div>
            <div className="competitor-bar">
              <span
                style={{
                  width: `${Math.max(0, Math.min(c.shareOfVoice, 100))}%`,
                }}
              />
            </div>
            <strong className="competitor-percent">
              {percent(c.shareOfVoice)}
            </strong>
          </div>
        ))
      ) : (
        <div className="inline-empty">
          No valid recommendation appearances yet.
        </div>
      )}
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Target;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="empty panel">
      <span className="empty-icon">
        <Icon size={28} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}
function Dialog({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(".dialog-close")?.focus(),
    );
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = body;
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const nodes = e.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select,textarea,[tabindex="0"]',
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <section
        className={`dialog ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <div className="eyebrow">TABLESIGNAL WORKSPACE</div>
            <h2 id="dialog-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={21} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
      </section>
    </div>
  );
}

function QuestionWorkspace({
  bank,
  restaurant,
  busy,
  onSave,
}: {
  bank: Bootstrap["banks"][0] | undefined;
  restaurant?: Restaurant;
  busy: string;
  onSave: (queries: Query[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Query[]>([]);
  useEffect(() => {
    if (bank) {
      setDraft(bank.queries.map((q) => ({ ...q })));
      setEditing(false);
    }
  }, [bank?.id]);
  const intents = [...new Set((bank?.queries || []).flatMap((q) => q.intents))];
  return (
    <section className="panel question-workspace">
      <div className="panel-heading">
        <div>
          <h2>
            {restaurant?.name || "Restaurant"}{" "}
            <span className="heading-sub">
              / Question bank {bank ? `v${bank.version}` : ""}
            </span>
          </h2>
          <p>
            {bank
              ? "Saved banks are frozen. Edits create a new version for future measurements."
              : "Create a restaurant profile to generate a question bank."}
          </p>
        </div>
        <div className="button-row">
          {editing ? (
            <>
              <button
                className="button secondary small"
                onClick={() => {
                  setEditing(false);
                  setDraft(bank?.queries.map((q) => ({ ...q })) || []);
                }}
              >
                Cancel
              </button>
              <button
                className="button primary small"
                disabled={!!busy || draft.some((q) => !q.text.trim())}
                onClick={() => onSave(draft)}
              >
                <Check size={15} />
                Save new version
              </button>
            </>
          ) : (
            <button
              className="button secondary small"
              disabled={!bank}
              onClick={() => setEditing(true)}
            >
              <PencilLine size={15} />
              Edit questions
            </button>
          )}
        </div>
      </div>
      <div className="bank-meta">
        <span>
          <MessageSquareText size={15} />
          {draft.length} questions
        </span>
        <span>
          <ListFilter size={15} />
          {intents.length} intent dimensions
        </span>
        <span>
          <ShieldCheck size={15} />
          Versioned for repeat measurement
        </span>
      </div>
      <div className="query-bank-list">
        {draft.map((q, i) => (
          <div className="query-bank-row" key={q.id}>
            <span className="query-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              {editing ? (
                <label className="sr-label">
                  <span className="sr-only">Question {i + 1}</span>
                  <textarea
                    value={q.text}
                    rows={2}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev.map((item) =>
                          item.id === q.id
                            ? { ...item, text: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
              ) : (
                <strong>{q.text}</strong>
              )}
              <div className="chip-row">
                {q.intents.map((t) => (
                  <span className="intent-tag" key={t}>
                    {t}
                  </span>
                ))}
                {q.branded && (
                  <span className="tag">Branded · excluded from discovery</span>
                )}
              </div>
            </div>
            {!editing && <ShieldCheck size={16} className="muted" />}
          </div>
        ))}
      </div>
      <div className="table-foot">
        <CircleHelp size={14} /> Questions test preferences; they do not claim
        your restaurant satisfies them.{" "}
        <span className="bank-hash">{bank?.contentHash.slice(0, 12)}</span>
      </div>
    </section>
  );
}

function ContentWorkspace({
  artifacts,
  runs,
  selectedId,
  onSelect,
  sources,
  onSource,
  busy,
  onSave,
  onBrowse,
  notify,
}: {
  artifacts: ArtifactVersion[];
  runs: Run[];
  selectedId: string;
  onSelect: (id: string) => void;
  sources: SourceSnapshot[];
  onSource: (s: SourceSnapshot) => void;
  busy: string;
  onSave: (a: ArtifactVersion, c: string) => void;
  onBrowse: () => void;
  notify: (s: string) => void;
}) {
  const sorted = [...artifacts].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const artifact = artifacts.find((a) => a.id === selectedId) || sorted[0];
  const originRun = runs.find((run) => run.id === artifact?.runId);
  const [content, setContent] = useState("");
  const [view, setView] = useState<"edit" | "preview">("edit");
  useEffect(() => setContent(artifact?.content || ""), [artifact?.id]);
  const dirty = artifact && content !== artifact.content;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      notify("Draft copied to your clipboard.");
    } catch {
      notify("Clipboard unavailable. Select and copy the text in the editor.");
    }
  };
  if (!artifact)
    return (
      <Empty
        icon={PencilLine}
        title="A good draft starts with a useful finding"
        description="Choose an opportunity to create a FAQ, restaurant copy, or structured data from your known facts."
        action={
          <button className="button primary" onClick={onBrowse}>
            Explore opportunities <ArrowRight size={16} />
          </button>
        }
      />
    );
  return (
    <div className="studio-layout">
      <aside className="panel draft-list">
        <div className="draft-list-title">
          <h3>Your drafts</h3>
          <span className="count-label">{artifacts.length}</span>
        </div>
        {sorted.map((a) => (
          <button
            key={a.id}
            className={`draft-item ${a.id === artifact.id ? "selected" : ""}`}
            onClick={() => {
              if (
                dirty &&
                !window.confirm(
                  "Discard your unsaved changes and open another draft?",
                )
              )
                return;
              onSelect(a.id);
            }}
          >
            <span className="draft-icon">
              {a.type === "jsonld" ? (
                <Code2 size={18} />
              ) : (
                <FileText size={18} />
              )}
            </span>
            <span>
              <strong>{typeNames[a.type]}</strong>
              <span>
                Version {a.version} · {date(a.createdAt)}
              </span>
            </span>
          </button>
        ))}
        <button className="text-link" onClick={onBrowse}>
          <Plus size={14} />
          Create another draft
        </button>
      </aside>
      <section className="panel content-editor">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">REVIEW BEFORE YOU USE</div>
            <h2>{typeNames[artifact.type]}</h2>
            <p>
              Version {artifact.version} · {date(artifact.createdAt)}{" "}
              {dirty ? "· Unsaved changes" : ""}
            </p>
          </div>
          <span
            className={`tag ${artifact.validation.valid ? "green" : "amber"}`}
          >
            {artifact.validation.valid ? (
              <CheckCircle2 size={12} />
            ) : (
              <CircleHelp size={12} />
            )}{" "}
            {artifact.validation.valid ? "Validated syntax" : "Needs attention"}
          </span>
        </div>
        {originRun && (
          <div className="artifact-origin">
            <Clock3 size={14} />
            <span>
              Created from the {modeName(originRun).toLowerCase()} of{" "}
              {date(originRun.createdAt)}. Sources stay attached to this draft’s
              original finding.
            </span>
          </div>
        )}
        {artifact.requiresConfirmation && (
          <div className="confirmation-note">
            <ShieldCheck size={16} />
            Review required. Confirm every factual claim before using this
            content.
          </div>
        )}
        <div className="editor-toolbar">
          <div className="tabs">
            <button
              className={view === "edit" ? "selected" : ""}
              onClick={() => setView("edit")}
            >
              <PencilLine size={13} />
              Editor
            </button>
            <button
              className={view === "preview" ? "selected" : ""}
              onClick={() => setView("preview")}
            >
              Text preview
            </button>
          </div>
          <button className="text-link" onClick={copy}>
            <Copy size={14} />
            Copy
          </button>
        </div>
        {view === "edit" ? (
          <textarea
            className={`artifact-textarea ${artifact.type === "jsonld" ? "code" : ""}`}
            aria-label="Artifact content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={artifact.type !== "jsonld"}
          />
        ) : (
          <pre className="artifact-preview">{content}</pre>
        )}
        {artifact.validation.issues.length > 0 && (
          <div className="validation-issues" role="status">
            {artifact.validation.issues.map((issue, i) => (
              <p key={i}>
                <CircleHelp size={14} />
                {issue}
              </p>
            ))}
          </div>
        )}
        <div className="editor-actions">
          <span className="small-note">Edits create a new saved version.</span>
          <div className="button-row">
            <button
              className="button secondary"
              disabled={!dirty || !!busy || !content.trim()}
              onClick={() => onSave(artifact, content)}
            >
              {busy === "save-artifact" ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Check size={15} />
              )}
              Save version
            </button>
            <a
              className={`button primary ${!artifact.validation.valid || dirty ? "disabled" : ""}`}
              aria-disabled={!artifact.validation.valid || dirty}
              href={
                !artifact.validation.valid || dirty
                  ? undefined
                  : `/api/artifacts/${artifact.id}/export`
              }
              onClick={(e) => {
                if (!artifact.validation.valid || dirty) e.preventDefault();
              }}
            >
              <ArrowDownToLine size={15} />
              Download {artifact.type === "jsonld" ? "JSON-LD" : "Markdown"}
            </a>
          </div>
        </div>
        <div className="artifact-evidence">
          <h3>
            <FileText size={14} />
            Source provenance
          </h3>
          {artifact.sourceIds.length ? (
            artifact.sourceIds.map((id) => {
              const source = sources.find((s) => s.id === id);
              return (
                source && (
                  <button
                    key={id}
                    className="source-pill"
                    onClick={() => onSource(source)}
                  >
                    {source.title}
                    <ArrowUpRight size={12} />
                  </button>
                )
              );
            })
          ) : (
            <p className="small-note">
              Profile facts. Review the restaurant profile for recorded
              provenance.
            </p>
          )}
          <p className="small-note">
            Content is exported for your review. Publication is not configured
            in this build.
          </p>
        </div>
      </section>
    </div>
  );
}

function Measurement({
  runs,
  artifacts,
  banks,
  onError,
}: {
  runs: Run[];
  artifacts: ArtifactVersion[];
  banks: Bootstrap["banks"];
  onError: (s: string) => void;
}) {
  const complete = runs.filter((r) => !isActive(r));
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(false);
  const oldest = complete[complete.length - 1]?.id || "";
  const newest = complete[0]?.id || "";
  const selectedBefore = complete.some((r) => r.id === before)
    ? before
    : oldest;
  const selectedAfter = complete.some((r) => r.id === after) ? after : newest;
  useEffect(() => {
    if (!selectedBefore || !selectedAfter || selectedBefore === selectedAfter) {
      setComparison(null);
      return;
    }
    let stopped = false;
    setLoading(true);
    api<Comparison>(
      `/comparisons?before=${encodeURIComponent(selectedBefore)}&after=${encodeURIComponent(selectedAfter)}`,
    )
      .then((c) => {
        if (!stopped) setComparison(c);
      })
      .catch((e) => {
        if (!stopped) onError(e.message);
      })
      .finally(() => {
        if (!stopped) setLoading(false);
      });
    return () => {
      stopped = true;
    };
  }, [selectedBefore, selectedAfter]);
  const beforeRun = runs.find((r) => r.id === selectedBefore),
    afterRun = runs.find((r) => r.id === selectedAfter);
  return (
    <>
      <section className="panel comparison-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">SAME QUESTIONS. HONEST COMPARISONS.</div>
            <h2>Put two snapshots side by side.</h2>
            <p>
              Only matching questions with valid results in both runs contribute
              to the comparison.
            </p>
          </div>
          <span className="subtle-icon">
            <TrendingUp size={20} />
          </span>
        </div>
        <div className="run-selectors">
          <label>
            <span>BASELINE</span>
            <select
              value={selectedBefore}
              onChange={(e) => setBefore(e.target.value)}
              aria-label="Baseline run"
            >
              {complete.length ? (
                complete.map((r) => (
                  <option key={r.id} value={r.id}>
                    {date(r.createdAt)} · {r.status}
                  </option>
                ))
              ) : (
                <option>No completed runs</option>
              )}
            </select>
            <span className="small-note">
              {modeName(beforeRun)} · {beforeRun?.model || "No provider"}
            </span>
          </label>
          <div className="compare-arrow">
            <ArrowRight size={21} />
          </div>
          <label>
            <span>FOLLOW-UP</span>
            <select
              value={selectedAfter}
              onChange={(e) => setAfter(e.target.value)}
              aria-label="Follow-up run"
            >
              {complete.length ? (
                complete.map((r) => (
                  <option key={r.id} value={r.id}>
                    {date(r.createdAt)} · {r.status}
                  </option>
                ))
              ) : (
                <option>No completed runs</option>
              )}
            </select>
            <span className="small-note">
              {modeName(afterRun)} · {afterRun?.model || "No provider"}
            </span>
          </label>
        </div>
        {loading ? (
          <div className="inline-empty">
            <LoaderCircle size={18} className="spin" /> Comparing saved
            observations…
          </div>
        ) : !comparison ? (
          <div className="comparison-empty">
            <RefreshCw size={27} />
            <h3>Your next run makes the comparison.</h3>
            <p>
              {complete.length < 2
                ? "Repeat this measurement to create a second snapshot using the same bank and configuration."
                : "Choose two different runs to inspect the changes."}
            </p>
            <span className="tag">Synthetic repeat runs may be unchanged</span>
          </div>
        ) : (
          <>
            <div
              className={`compatibility ${comparison.compatible ? "valid" : "invalid"}`}
            >
              {comparison.compatible ? (
                <ShieldCheck size={18} />
              ) : (
                <CircleHelp size={18} />
              )}
              <div>
                <strong>
                  {comparison.compatible
                    ? "These runs use compatible settings"
                    : "Headline comparison unavailable"}
                </strong>
                <span>
                  {comparison.compatible
                    ? `${comparison.matched} matched valid question/sample pairs · ${comparison.excluded} excluded pairs`
                    : comparison.reasons.join(" · ")}
                </span>
              </div>
            </div>
            {comparison.compatible && (
              <div className="comparison-metrics">
                <CompareMetric
                  label="Mention rate"
                  before={percent(comparison.beforeMetrics?.mentionRate)}
                  after={percent(comparison.afterMetrics?.mentionRate)}
                  delta={comparison.mentionRateChange}
                />
                <CompareMetric
                  label="Recommendation rate"
                  before={percent(comparison.beforeMetrics?.recommendationRate)}
                  after={percent(comparison.afterMetrics?.recommendationRate)}
                  delta={comparison.recommendationRateChange}
                />
                <div className="compare-stat">
                  <span>Matched coverage</span>
                  <strong>
                    {comparison.matched} <small>pairs</small>
                  </strong>
                  <p>Valid observations in both snapshots</p>
                </div>
              </div>
            )}
            <div className="comparison-limitations">
              {comparison.limitations.map((l, i) => (
                <p key={i}>
                  <CircleHelp size={14} />
                  {l}
                </p>
              ))}
            </div>
            {comparison.compatible && comparison.pairs.length > 0 && (
              <details className="pair-details">
                <summary>
                  Inspect {comparison.pairs.length} matched questions
                </summary>
                <div className="matched-table">
                  {comparison.pairs.map((p, i) => (
                    <div key={`${p.queryId}-${i}`}>
                      <span className="matched-question">
                        {banks
                          .flatMap((b) => b.queries)
                          .find((q) => q.id === p.queryId)?.text || p.queryId}
                      </span>
                      <span>
                        Before:{" "}
                        {p.beforeMention ? "mentioned" : "not mentioned"}
                      </span>
                      <ArrowRight size={12} />
                      <span>
                        After: {p.afterMention ? "mentioned" : "not mentioned"}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </section>
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>Your measurement history</h2>
            <p>
              Saved runs and content changes stay in order. Timing alone does
              not establish cause.
            </p>
          </div>
          <Clock3 size={19} className="muted" />
        </div>
        <div className="history-list">
          {[
            ...runs.map((r) => ({
              id: r.id,
              time: r.createdAt,
              title: `${modeName(r)} · ${r.status}`,
              detail: `${r.provider} / ${r.model} · ${r.results.filter((q) => q.status === "succeeded").length} completed answers`,
              type: "run",
            })),
            ...artifacts.map((a) => ({
              id: a.id,
              time: a.createdAt,
              title: `${typeNames[a.type]} · version ${a.version}`,
              detail: "Draft saved locally · no external publication",
              type: "artifact",
            })),
          ]
            .sort((a, b) => b.time.localeCompare(a.time))
            .map((event) => (
              <div className="history-event" key={event.id}>
                <span className={`history-icon ${event.type}`}>
                  {event.type === "run" ? (
                    <Target size={15} />
                  ) : (
                    <FileText size={15} />
                  )}
                </span>
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.detail}</p>
                </div>
                <time>{date(event.time)}</time>
              </div>
            ))}
        </div>
      </section>
    </>
  );
}
function CompareMetric({
  label,
  before,
  after,
  delta,
}: {
  label: string;
  before: string;
  after: string;
  delta: number | null;
}) {
  return (
    <div className="compare-stat">
      <span>{label}</span>
      <div>
        <strong>{before}</strong>
        <ArrowRight size={18} />
        <strong>{after}</strong>
      </div>
      <p className={delta && delta > 0 ? "positive" : ""}>
        {delta == null
          ? "No valid matched observations"
          : `${delta > 0 ? "+" : ""}${Number(delta.toFixed(1))} percentage points${delta === 0 ? " · unchanged" : ""}`}
      </p>
    </div>
  );
}

function RestaurantSetup({
  restaurant,
  sources,
  allSources,
  onSource,
  onRefresh,
  busy,
  onCreate,
  onConfirm,
  collecting,
  provider,
}: {
  restaurant?: Restaurant;
  sources: SourceSnapshot[];
  allSources: SourceSnapshot[];
  onSource: (s: SourceSnapshot) => void;
  onRefresh: () => void;
  busy: string;
  onCreate: (form: unknown) => void;
  onConfirm: (factIndexes: number[]) => void;
  collecting: boolean;
  provider: Bootstrap["provider"];
}) {
  const [add, setAdd] = useState(!restaurant);
  useEffect(() => {
    if (restaurant) setAdd(false);
  }, [restaurant?.id]);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [selectedFacts, setSelectedFacts] = useState<number[]>([]);
  useEffect(() => setSelectedFacts([]), [restaurant?.id]);
  const synthetic = restaurant?.facts.some((f) => f.provenance === "synthetic");
  const draftFacts = restaurant?.facts.filter((f) => !f.confirmed).length || 0;
  const identityReady = Boolean(
    restaurant?.name.trim() &&
      restaurant.location.trim() &&
      /^https?:\/\//i.test(restaurant.website),
  );
  return (
    <div className="setup-grid">
      <section className="panel profile-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">CANONICAL RESTAURANT PROFILE</div>
            <h2>{restaurant?.name || "Restaurant profile"}</h2>
          </div>
          <button
            className="button secondary small"
            onClick={() => setAdd(!add)}
          >
            <Plus size={14} />
            Add restaurant
          </button>
        </div>
        {restaurant && (
          <>
            <div className="profile-identity">
              <span className="profile-monogram">
                {restaurant.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div>
                <h3>{restaurant.name}</h3>
                <p>
                  <MapPin size={14} />
                  {restaurant.location}
                </p>
                <p>
                  <Globe2 size={14} />
                  {restaurant.website}
                </p>
              </div>
            </div>
            <div className="profile-confirmation">
              <span
                className={`tag ${restaurant.confirmedAt ? "green" : "amber"}`}
              >
                <ShieldCheck size={13} />
                {restaurant.confirmedAt
                  ? "Business identity confirmed"
                  : "Confirm business identity"}
              </span>
              {synthetic && (
                <span className="tag">Fictional demo restaurant</span>
              )}
            </div>
            {!restaurant.confirmedAt && (
              <div className="identity-review">
                <div>
                  <strong>Is this the right restaurant and branch?</strong>
                  <p>
                    Confirm the name, website, and location. Public page
                    observations are reviewed separately below.
                  </p>
                </div>
                <button
                  className="button primary small"
                  onClick={() => onConfirm([])}
                  disabled={!!busy || !identityReady}
                >
                  <CheckCircle2 size={15} /> Confirm identity
                </button>
              </div>
            )}
            <div className="fact-review-heading">
              <div>
                <h3>Publicly observed profile facts</h3>
                <p>
                  {draftFacts
                    ? `${draftFacts} observed fact${draftFacts === 1 ? " needs" : "s need"} review. Inspect the source, then select the facts you accept.`
                    : "Accepted facts keep their original source and collection time."}
                </p>
              </div>
              {collecting && (
                <span className="tag">
                  <LoaderCircle size={12} className="spin" /> Checking for
                  collected pages
                </span>
              )}
            </div>
            <div className="facts-table">
              <div className="facts-header">
                <span>Fact to review</span>
                <span>Value & provenance</span>
              </div>
              {restaurant.facts.length ? (
                restaurant.facts.map((f, i) => (
                  <div
                    className={`fact-row ${!f.confirmed ? "draft-fact" : ""}`}
                    key={`${f.field}-${i}`}
                  >
                    <strong>
                      {!f.confirmed && (
                        <input
                          type="checkbox"
                          aria-label={`Accept source fact: ${factLabel(f.field)}, ${f.value}`}
                          checked={selectedFacts.includes(i)}
                          disabled={
                            !!busy ||
                            (f.provenance === "website" &&
                              !allSources.some(
                                (s) =>
                                  s.id === f.sourceId &&
                                  s.status === "succeeded",
                              ))
                          }
                          onChange={(e) =>
                            setSelectedFacts((prev) =>
                              e.target.checked
                                ? [...prev, i]
                                : prev.filter((index) => index !== i),
                            )
                          }
                        />
                      )}
                      {factLabel(f.field)}
                    </strong>
                    <div>
                      <span>{f.value}</span>
                      <small>
                        {f.provenance === "synthetic"
                          ? "Synthetic fixture"
                          : f.provenance === "owner"
                            ? "Owner-provided"
                            : "Public website"}{" "}
                        · {f.confirmed ? "accepted" : "review required"}
                        {f.sourceId && (
                          <button
                            onClick={() => {
                              const s = allSources.find(
                                (s) => s.id === f.sourceId,
                              );
                              if (s) onSource(s);
                            }}
                          >
                            Inspect source <ArrowUpRight size={10} />
                          </button>
                        )}
                      </small>
                      {f.evidenceSpan && !f.confirmed && (
                        <blockquote className="fact-evidence">
                          {f.evidenceSpan}
                        </blockquote>
                      )}
                      {f.sourceId &&
                        allSources.find((s) => s.id === f.sourceId)
                          ?.fetchedAt && (
                          <small>
                            Collected{" "}
                            {date(
                              allSources.find((s) => s.id === f.sourceId)
                                ?.fetchedAt,
                            )}
                          </small>
                        )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="inline-empty">
                  No profile facts observed yet. Collect public pages to create
                  a source-backed draft. Missing facts remain unknown.
                </div>
              )}
            </div>
            {draftFacts > 0 && (
              <div className="profile-actions fact-review-actions">
                <p>
                  {selectedFacts.length} fact
                  {selectedFacts.length === 1 ? "" : "s"} selected. Accepting a
                  public observation preserves its website provenance; it does
                  not turn it into an owner statement.
                </p>
                <button
                  className="button primary"
                  onClick={() => {
                    onConfirm(selectedFacts);
                    setSelectedFacts([]);
                  }}
                  disabled={!!busy || !selectedFacts.length}
                >
                  <CheckCircle2 size={15} />
                  Accept selected source facts
                </button>
              </div>
            )}
          </>
        )}
        {add && (
          <form
            className="restaurant-form"
            onSubmit={(e) => {
              e.preventDefault();
              onCreate({
                name,
                website,
                location,
                facts: [],
              });
            }}
          >
            <h3>Add a restaurant</h3>
            <p>
              Start with the public name, website, and branch. Website facts are
              collected as drafts for source review.
            </p>
            <label>
              Restaurant name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Your restaurant"
                maxLength={160}
              />
            </label>
            <label>
              Public website
              <input
                required
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://restaurant.com"
              />
            </label>
            <label>
              Location / branch
              <input
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Neighborhood, city"
                maxLength={200}
              />
            </label>
            <button
              className="button primary"
              disabled={
                !!busy || !name.trim() || !website.trim() || !location.trim()
              }
            >
              <Plus size={16} />
              Create profile & question bank
            </button>
          </form>
        )}
      </section>
      <aside className="setup-aside">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">THE SOURCE OF TRUTH</div>
              <h2>Evidence library</h2>
              <p>Public pages captured with timestamps and source excerpts.</p>
            </div>
            <button
              className="icon-button"
              aria-label="Recollect public source pages"
              title={
                synthetic
                  ? "Fictional examples do not collect public pages"
                  : "Recollect public source pages"
              }
              onClick={onRefresh}
              disabled={!!busy || collecting || !restaurant || synthetic}
            >
              <RefreshCw
                size={17}
                className={
                  busy === "refresh-evidence" || collecting ? "spin" : ""
                }
              />
            </button>
          </div>
          {(collecting ||
            restaurant?.lastCollectedAt ||
            restaurant?.collectionError) && (
            <div
              className={`collection-status ${restaurant?.collectionStatus === "failed" ? "failed" : ""}`}
              role="status"
            >
              {collecting ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Clock3 size={15} />
              )}
              <span>
                {collecting
                  ? "Collecting public pages and preparing draft facts…"
                  : restaurant?.collectionError
                    ? `Collection incomplete: ${restaurant.collectionError}`
                    : `Last collected ${date(restaurant?.lastCollectedAt)}`}
              </span>
            </div>
          )}
          <div className="evidence-list">
            {sources.length ? (
              sources.map((s) => (
                <button key={s.id} onClick={() => onSource(s)}>
                  <span
                    className={`source-icon ${s.status === "failed" ? "failed" : ""}`}
                  >
                    {s.status === "failed" ? (
                      <XCircle size={16} />
                    ) : (
                      <FileText size={16} />
                    )}
                  </span>
                  <span>
                    <strong>{s.title}</strong>
                    <span>
                      {sourceLabel(s)} · {date(s.fetchedAt)}
                    </span>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))
            ) : (
              <div className="inline-empty">
                No sources collected yet. Website collection may still be in
                progress.
              </div>
            )}
          </div>
        </section>
        <section className="panel provider-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">MEASUREMENT CONNECTION</div>
              <h2>Live provider</h2>
              <p>
                {provider.name ||
                  provider.adapter ||
                  "No verified provider connection"}
              </p>
            </div>
            <span className={`tag ${provider.configured ? "green" : "amber"}`}>
              {provider.configured ? (
                <CheckCircle2 size={12} />
              ) : (
                <CircleHelp size={12} />
              )}
              {provider.configured ? "Connected" : "Unavailable"}
            </span>
          </div>
          <div className="provider-details">
            <p>
              {provider.status ||
                (provider.configured
                  ? "Provider authentication verified."
                  : "Provider authentication has not been verified. Live measurements are unavailable until a connection is ready.")}
            </p>
            {provider.model && <span>Model · {provider.model}</span>}
          </div>
        </section>
        <div className="trust-note">
          <ShieldCheck size={24} />
          <h3>Unknown is a useful answer.</h3>
          <p>
            We don’t invent menu items, prices, dietary assurances, hours, or
            awards. Public observations retain their source snapshots and stay
            drafts until reviewed.
          </p>
        </div>
      </aside>
    </div>
  );
}
