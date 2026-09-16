// Public-information reconstruction, not a record of a strategy actually run then.
export function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateHistoricalEvidence(data) {
  const errors = [];
  const documentIds = new Set(), facts = new Map();
  const companies = new Set(data.companies.map(c => c.ticker));
  for (const doc of data.documents) {
    if (documentIds.has(doc.id)) errors.push(`Duplicate document: ${doc.id}`);
    documentIds.add(doc.id);
    if (!companies.has(doc.ticker)) errors.push(`Unknown company: ${doc.id}`);
    if (![doc.publishedOn, doc.periodEnd, doc.recordedOn].every(isIsoDate)) errors.push(`Invalid date: ${doc.id}`);
    if (doc.periodEnd > doc.publishedOn || doc.publishedOn > doc.recordedOn) errors.push(`Invalid chronology: ${doc.id}`);
    try {
      const url = new URL(doc.sourceUrl);
      if (url.protocol !== "https:" || !["nvidianews.nvidia.com", "investor.tsmc.com", "static.cninfo.com.cn", "www.zijinmining.com"].includes(url.hostname)) errors.push(`Unapproved source: ${doc.id}`);
    } catch { errors.push(`Invalid source: ${doc.id}`); }
    if (!doc.publicationBasis || !doc.basis) errors.push(`Missing basis: ${doc.id}`);
    for (const fact of doc.facts) {
      if (facts.has(fact.id)) errors.push(`Duplicate fact: ${fact.id}`);
      if (!Number.isFinite(fact.value) || !fact.unit || !fact.location || !fact.metric) errors.push(`Invalid fact: ${fact.id}`);
      if (!isIsoDate(fact.periodEnd) || fact.periodEnd > doc.publishedOn) errors.push(`Invalid fact date: ${fact.id}`);
      facts.set(fact.id, {...fact, ticker: doc.ticker, publishedOn: doc.publishedOn});
    }
  }
  for (const fact of facts.values()) {
    if (fact.revision === "restated" && !fact.supersedes) errors.push(`Missing revision target: ${fact.id}`);
    if (!fact.supersedes) continue;
    const prior = facts.get(fact.supersedes);
    if (!prior || prior.ticker !== fact.ticker || prior.metric !== fact.metric || prior.period !== fact.period || prior.unit !== fact.unit || prior.publishedOn >= fact.publishedOn) errors.push(`Invalid revision: ${fact.id}`);
  }
  return errors;
}

export function selectHistoricalEvidence(data, {asOf, ticker = "all", mode = "public"}) {
  if (!isIsoDate(asOf)) throw new Error("请选择有效的观察日期。");
  if (!["public", "recorded"].includes(mode)) throw new Error("未知时间口径。");
  // A date alone cannot establish intraday availability. Exclude release day.
  const documents = data.documents.filter(doc =>
    (ticker === "all" || doc.ticker === ticker) && doc.publishedOn < asOf &&
    (mode === "public" || doc.recordedOn < asOf)
  ).sort((a, b) => b.publishedOn.localeCompare(a.publishedOn) || a.id.localeCompare(b.id));
  const versions = documents.flatMap(doc => doc.facts.map(fact => ({...fact,
    documentId: doc.id, ticker: doc.ticker, name: doc.name,
    publishedOn: doc.publishedOn, recordedOn: doc.recordedOn, sourceUrl: doc.sourceUrl,
  })));
  const current = new Map();
  for (const fact of versions) {
    const key = [fact.ticker, fact.metric, fact.period, fact.unit].join("|");
    if (!current.has(key)) current.set(key, fact);
  }
  return {documents, versions, currentFacts: [...current.values()]};
}
