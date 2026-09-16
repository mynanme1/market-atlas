import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ticker: text("ticker").notNull(),
  market: text("market").notNull(),
  sector: text("sector").notNull(),
  chain: text("chain").notNull(),
  position: text("position").notNull(),
  summary: text("summary").notNull(),
  moat: text("moat").notNull(),
  catalyst: text("catalyst").notNull(),
  risk: text("risk").notNull(),
  color: text("color").notNull(),
});

export const relations = sqliteTable("relations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: integer("source_id").notNull(),
  targetId: integer("target_id").notNull(),
  type: text("type").notNull(),
  note: text("note").notNull(),
});

export const companyChainMemberships = sqliteTable("company_chain_memberships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  chainName: text("chain_name").notNull(),
  stage: text("stage").notNull(),
  stageOrder: integer("stage_order").notNull(),
  role: text("role").notNull(),
  strength: integer("strength").notNull().default(3),
  evidence: text("evidence").notNull().default(""),
  verifiedAt: text("verified_at").notNull().default(""),
});

export const companyTags = sqliteTable("company_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  tagType: text("tag_type").notNull(),
  tagName: text("tag_name").notNull(),
  strength: integer("strength").notNull().default(3),
  evidence: text("evidence").notNull().default(""),
  verifiedAt: text("verified_at").notNull().default(""),
});

export const macroExposures = sqliteTable("macro_exposures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  factor: text("factor").notNull(),
  direction: text("direction").notNull(),
  sensitivity: text("sensitivity").notNull(),
  evidence: text("evidence").notNull().default(""),
  verifiedAt: text("verified_at").notNull().default(""),
});

export const chainStages = sqliteTable("chain_stages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chainName: text("chain_name").notNull(),
  stageOrder: integer("stage_order").notNull(),
  stageName: text("stage_name").notNull(),
  description: text("description").notNull().default(""),
});

export const relationMetadata = sqliteTable("relation_metadata", {
  relationId: integer("relation_id").primaryKey(),
  relationClass: text("relation_class").notNull().default("产业推断"),
  confidence: integer("confidence").notNull().default(2),
  strength: integer("strength").notNull().default(3),
  status: text("status").notNull().default("待核验"),
  asOfDate: text("as_of_date").notNull().default(""),
  analystNote: text("analyst_note").notNull().default(""),
});

export const evidenceSources = sqliteTable("evidence_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  url: text("url").notNull().default(""),
  sourceType: text("source_type").notNull(),
  publisher: text("publisher").notNull().default(""),
  publishedAt: text("published_at").notNull().default(""),
  accessedAt: text("accessed_at").notNull().default(""),
  excerpt: text("excerpt").notNull().default(""),
});

export const relationEvidence = sqliteTable("relation_evidence", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  relationId: integer("relation_id").notNull(),
  evidenceId: integer("evidence_id").notNull(),
  supportLevel: text("support_level").notNull().default("支持"),
});

export const drivers = sqliteTable("drivers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull(),
  probability: integer("probability").notNull(),
  horizon: text("horizon").notNull(),
  leadingIndicator: text("leading_indicator").notNull().default(""),
  evidenceStatus: text("evidence_status").notNull().default("待核验"),
  updatedAt: text("updated_at").notNull().default(""),
});

export const driverImpacts = sqliteTable("driver_impacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  driverId: integer("driver_id").notNull(),
  targetType: text("target_type").notNull(),
  targetKey: text("target_key").notNull(),
  direction: text("direction").notNull(),
  strength: integer("strength").notNull(),
  transmission: text("transmission").notNull().default(""),
});

export const scenarios = sqliteTable("scenarios", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  probability: integer("probability").notNull(),
  description: text("description").notNull().default(""),
  impactMultiplier: real("impact_multiplier").notNull().default(1),
});

export const sourceDocuments = sqliteTable("source_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  documentType: text("document_type").notNull(),
  title: text("title").notNull(),
  reportingPeriod: text("reporting_period").notNull().default(""),
  publicationDate: text("publication_date").notNull().default(""),
  url: text("url").notNull().default(""),
  sourceTier: text("source_tier").notNull(),
  extractionStatus: text("extraction_status").notNull().default("待提取"),
});

export const extractedFacts = sqliteTable("extracted_facts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  documentId: integer("document_id").notNull(),
  factType: text("fact_type").notNull(),
  label: text("label").notNull(),
  valueText: text("value_text").notNull().default(""),
  unit: text("unit").notNull().default(""),
  reportingPeriod: text("reporting_period").notNull().default(""),
  location: text("location").notNull().default(""),
  evidenceSummary: text("evidence_summary").notNull().default(""),
  confidence: integer("confidence").notNull().default(3),
  verifiedAt: text("verified_at").notNull().default(""),
});

export const driverFactLinks = sqliteTable("driver_fact_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  driverId: integer("driver_id").notNull(),
  factId: integer("fact_id").notNull(),
  stance: text("stance").notNull().default("支持"),
  relevance: integer("relevance").notNull().default(3),
  rationale: text("rationale").notNull().default(""),
});

export const paperAccounts = sqliteTable("paper_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  baseCurrency: text("base_currency").notNull().default("CNY"),
  initialCash: real("initial_cash").notNull(),
  cash: real("cash").notNull(),
  commissionBps: real("commission_bps").notNull().default(3),
  slippageBps: real("slippage_bps").notNull().default(5),
  createdAt: text("created_at").notNull().default(""),
});

export const priceSnapshots = sqliteTable("price_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  symbol: text("symbol").notNull(),
  price: real("price").notNull(),
  currency: text("currency").notNull(),
  fxToCny: real("fx_to_cny").notNull().default(1),
  priceCny: real("price_cny").notNull(),
  priceDate: text("price_date").notNull(),
  source: text("source").notNull().default(""),
  capturedAt: text("captured_at").notNull().default(""),
});

export const paperOrders = sqliteTable("paper_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull(),
  companyId: integer("company_id").notNull(),
  side: text("side").notNull(),
  quantity: real("quantity").notNull(),
  signalDate: text("signal_date").notNull(),
  signalPriceCny: real("signal_price_cny").notNull().default(0),
  status: text("status").notNull().default("待成交"),
  submittedAt: text("submitted_at").notNull().default(""),
  filledAt: text("filled_at").notNull().default(""),
  filledPriceCny: real("filled_price_cny").notNull().default(0),
  fees: real("fees").notNull().default(0),
  rationale: text("rationale").notNull().default(""),
  driverName: text("driver_name").notNull().default(""),
});

export const paperPositions = sqliteTable("paper_positions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull(),
  companyId: integer("company_id").notNull(),
  quantity: real("quantity").notNull(),
  avgCostCny: real("avg_cost_cny").notNull(),
  updatedAt: text("updated_at").notNull().default(""),
});

export const paperNavSnapshots = sqliteTable("paper_nav_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull(),
  snapshotDate: text("snapshot_date").notNull(),
  cash: real("cash").notNull(),
  marketValue: real("market_value").notNull(),
  totalValue: real("total_value").notNull(),
});

export const researchSnapshots = sqliteTable("research_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().unique(), companyId: integer("company_id").notNull(),
  snapshotDate: text("snapshot_date").notNull(), researchScore: real("research_score").notNull().default(0),
  evidenceCoverage: real("evidence_coverage").notNull().default(0), benchmarkSymbol: text("benchmark_symbol").notNull().default(""),
  horizon: text("horizon").notNull().default("中期"), invalidation: text("invalidation").notNull().default(""),
  thesis: text("thesis").notNull().default(""), createdAt: text("created_at").notNull().default(""),
});

export const strategyModelSnapshots = sqliteTable("strategy_model_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  snapshotDate: text("snapshot_date").notNull().unique(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull().default(""),
});

export const factorMetrics = sqliteTable("factor_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }), companyId: integer("company_id").notNull(),
  metric: text("metric").notNull(), value: real("value").notNull(), unit: text("unit").notNull().default(""),
  reportingPeriod: text("reporting_period").notNull(), publishedAt: text("published_at").notNull(),
  observedAt: text("observed_at").notNull(), sourceDocumentId: integer("source_document_id").notNull(),
  confidence: integer("confidence").notNull().default(3), createdAt: text("created_at").notNull().default(""),
});
