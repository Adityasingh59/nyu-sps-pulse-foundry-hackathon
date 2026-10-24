export type EvidenceMode = "synthetic" | "live";
export type RunStatus =
  "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";
export interface ProfileFact {
  evidenceSpan?: string;
  field: string;
  value: string;
  sourceId?: string;
  provenance: "owner" | "website" | "synthetic";
  confirmed: boolean;
}
export interface Restaurant {
  /** Missing on historical records, which retain restaurant behavior. */
  businessType?: "restaurant" | "business";
  category?: string;
  collectionStatus?: "collecting" | "completed" | "failed";
  collectionError?: string;
  lastCollectedAt?: string;
  id: string;
  name: string;
  website: string;
  location: string;
  aliases: string[];
  cuisine?: string;
  facts: ProfileFact[];
  confirmedAt?: string;
  createdAt: string;
}
export interface Query {
  id: string;
  text: string;
  intents: string[];
  branded: boolean;
}
export interface QueryBank {
  id: string;
  restaurantId: string;
  version: number;
  createdAt: string;
  contentHash: string;
  queries: Query[];
}
export interface Citation {
  url: string;
  title: string;
}
export interface Appearance {
  entityId: string;
  name: string;
  mention: boolean;
  recommended: boolean;
  position: number | null;
  evidenceSpan: string;
  ambiguous: boolean;
}
export interface QueryResult {
  id: string;
  queryId: string;
  sampleId: number;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  rawAnswer: string;
  appearances: Appearance[];
  citations: Citation[];
  error?: string;
  latencyMs?: number;
  executedAt?: string;
  attempts: number;
}
export interface Metrics {
  attempted: number;
  valid: number;
  excludedAmbiguous: number;
  mentions: number;
  recommendations: number;
  mentionRate: number | null;
  recommendationRate: number | null;
  averagePosition: number | null;
  positionSamples: number;
  shareOfVoice: number | null;
  coverage: number | null;
  totalRecommendationAppearances: number;
}
export interface Competitor {
  entityId: string;
  name: string;
  appearances: number;
  shareOfVoice: number;
  averagePosition: number | null;
  isTarget: boolean;
}
export interface Run {
  parserVersion?: string;
  analysisRevision?: number;
  parsedAt?: string;
  sourceSnapshotIds?: string[];
  evidenceStatus?: "collecting" | "completed" | "failed";
  evidenceCompletedAt?: string;
  evidenceWarnings?: string[];
  id: string;
  bankId: string;
  restaurantId: string;
  mode: EvidenceMode;
  provider: string;
  model: string;
  status: RunStatus;
  createdAt: string;
  completedAt?: string;
  settingsHash: string;
  promptVersion: string;
  retrieval: string;
  results: QueryResult[];
  metrics: Metrics | null;
  competitors: Competitor[];
  sourceRunId?: string;
}
export interface SourceSnapshot {
  review?: {
    status: "accepted" | "rejected";
    reason: string;
    reviewedAt: string;
  };
  sourceKind?: "website" | "manual" | "synthetic";
  contentType?: string;
  contentTruncated?: boolean;
  pageKind?: "home" | "menu" | "about" | "visit" | "other";
  draftFacts?: ProfileFact[];
  schemaTypes?: string[];
  schemaIssues?: string[];
  entityName?: string;
  entityId?: string;
  runId?: string;
  scope?: "target" | "competitor";
  id: string;
  restaurantId: string;
  url: string;
  title: string;
  fetchedAt: string;
  contentHash: string;
  excerpt: string;
  status: "succeeded" | "failed";
  error?: string;
  mode: EvidenceMode;
}
export interface Opportunity {
  revision?: number;
  id: string;
  runId: string;
  title: string;
  gap: string;
  sourceIds: string[];
  competitorExample?: string;
  intents: string[];
  action: string;
  effort: "low" | "medium" | "high";
  priority: number;
  rationale: string;
  uncertainty: string;
  artifactTypes: ArtifactType[];
}
export type ArtifactType = "faq" | "about" | "jsonld";
export interface ArtifactVersion {
  runId?: string;
  id: string;
  opportunityId: string;
  restaurantId: string;
  type: ArtifactType;
  content: string;
  version: number;
  contentHash: string;
  createdAt: string;
  validation: { valid: boolean; issues: string[] };
  sourceIds: string[];
  requiresConfirmation: boolean;
}
export interface Comparison {
  beforeRunId: string;
  afterRunId: string;
  compatible: boolean;
  reasons: string[];
  matched: number;
  excluded: number;
  beforeMetrics: Metrics | null;
  afterMetrics: Metrics | null;
  mentionRateChange: number | null;
  recommendationRateChange: number | null;
  pairs: { queryId: string; beforeMention: boolean; afterMention: boolean }[];
  limitations: string[];
}
export interface Bootstrap {
  restaurants: Restaurant[];
  banks: QueryBank[];
  runs: Run[];
  artifacts: ArtifactVersion[];
  sources: SourceSnapshot[];
  provider: {
    configured: boolean;
    model: string;
    name?: string;
    adapter?: "openai" | "codex-cli" | "claude-cli";
    status?: string;
  };
  demoRestaurantId: string;
  preferredRestaurantId?: string;
}
