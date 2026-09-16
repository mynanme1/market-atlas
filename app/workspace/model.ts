export type Company = {
  id: number; name: string; ticker: string; market: string; sector: string;
  chain: string; position: string; summary: string; moat: string;
  catalyst: string; risk: string; color: string;
};
export type Relation = { id: number; sourceId: number; targetId: number; type: string; note: string };
export type ChainMembership = { id: number; companyId: number; chainName: string; stage: string; stageOrder: number; role: string; strength: number; evidence: string; verifiedAt: string };
export type CompanyTag = { id: number; companyId: number; tagType: string; tagName: string; strength: number; evidence: string; verifiedAt: string };
export type MacroExposure = { id: number; companyId: number; factor: string; direction: string; sensitivity: string; evidence: string; verifiedAt: string };
export type ChainStage = { id: number; chainName: string; stageOrder: number; stageName: string; description: string };
export type RelationMeta = { relationId: number; relationClass: string; confidence: number; strength: number; status: string; asOfDate: string; analystNote: string };
export type EvidenceSource = { id: number; title: string; url: string; sourceType: string; publisher: string; publishedAt: string; accessedAt: string; excerpt: string };
export type RelationEvidence = { id: number; relationId: number; evidenceId: number; supportLevel: string };
export type Driver = { id: number; name: string; category: string; description: string; status: string; probability: number; horizon: string; leadingIndicator: string; evidenceStatus: string; updatedAt: string };
export type DriverImpact = { id: number; driverId: number; targetType: string; targetKey: string; direction: string; strength: number; transmission: string };
export type Scenario = { id: number; name: string; probability: number; description: string; impactMultiplier: number };
export type SourceDocument = { id: number; companyId: number; documentType: string; title: string; reportingPeriod: string; publicationDate: string; url: string; sourceTier: string; extractionStatus: string };
export type ExtractedFact = { id: number; companyId: number; documentId: number; factType: string; label: string; valueText: string; unit: string; reportingPeriod: string; location: string; evidenceSummary: string; confidence: number; verifiedAt: string };
export type DriverFactLink = { id: number; driverId: number; factId: number; stance: string; relevance: number; rationale: string };
export type FactorMetric = { id:number; companyId:number; metric:string; value:number; unit:string; reportingPeriod:string; publishedAt:string; observedAt:string; sourceDocumentId:number; confidence:number; createdAt:string };
export type Payload = {
  companies: Company[]; relations: Relation[]; memberships?: ChainMembership[]; tags?: CompanyTag[];
  exposures?: MacroExposure[]; stages?: ChainStage[]; relationMeta?: RelationMeta[];
  evidence?: EvidenceSource[]; relationEvidence?: RelationEvidence[]; drivers?: Driver[];
  driverImpacts?: DriverImpact[]; scenarios?: Scenario[];
  documents?: SourceDocument[]; facts?: ExtractedFact[];
  driverFactLinks?: DriverFactLink[];
  factorMetrics?: FactorMetric[];
};
