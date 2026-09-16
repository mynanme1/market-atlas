import { env } from "cloudflare:workers";
import { seedExpandedMarketData } from "./seedData";

const companySql = `CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, ticker TEXT NOT NULL,
  market TEXT NOT NULL, sector TEXT NOT NULL, chain TEXT NOT NULL, position TEXT NOT NULL,
  summary TEXT NOT NULL, moat TEXT NOT NULL, catalyst TEXT NOT NULL, risk TEXT NOT NULL,
  color TEXT NOT NULL
)`;
const relationSql = `CREATE TABLE IF NOT EXISTS relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, source_id INTEGER NOT NULL, target_id INTEGER NOT NULL,
  type TEXT NOT NULL, note TEXT NOT NULL
)`;
const seedCompanies = [
  ["英伟达","NVDA","美股","信息技术","AI算力","芯片设计","数据中心GPU与AI加速平台龙头","软硬件生态、CUDA与规模优势","云厂商资本开支、推理需求增长","出口限制、竞争与客户自研芯片","#b9f36b"],
  ["台积电","TSM","美股/台股","信息技术","半导体","晶圆代工","全球先进制程晶圆代工核心厂商","先进制程、良率与客户认证","AI芯片需求与先进封装扩产","地缘政治、资本开支周期","#6ee7d8"],
  ["中际旭创","300308","A股","通信","AI算力","光模块","高速光通信模块供应商","客户认证、量产能力与技术迭代","800G/1.6T升级与数据中心互联","产品降价、客户集中与技术路线变化","#68a5ff"],
  ["中国核电","601985","A股","公用事业","能源电力","核电运营","核电项目开发、投资、建设与运营","牌照、资源禀赋和长期运营能力","新机组投产、电价与核准提速","建设延期、利用小时与政策变化","#ffcb66"],
  ["东方电气","600875","A股/H股","工业","核电设备","主设备","能源装备制造与电站工程服务","大型装备技术与交付体系","核电核准、燃机与抽蓄订单","项目执行、原材料和回款周期","#ff8f70"],
  ["紫金矿业","601899","A股/H股","原材料","能源资源","铜金资源","全球化铜金资源开发企业","资源储备、低成本开发与并购能力","铜金价格、项目放量","商品周期、海外运营与汇率","#d993ff"],
];
const seedRelations = [[2,1,"供应","先进制程晶圆代工"],[1,3,"需求传导","AI集群推动高速互联"],[5,4,"供应","核电主设备与服务"],[6,5,"原料传导","铜等工业金属成本影响"],[4,1,"主题关联","AI数据中心长期电力需求"]];

async function init() {
  const db = env.DB;
  await db.batch([db.prepare(companySql), db.prepare(relationSql)]);
  const count = await db.prepare("SELECT COUNT(*) AS n FROM companies").first<{n:number}>();
  if (!count?.n) {
    await db.batch(seedCompanies.map(x => db.prepare("INSERT INTO companies (name,ticker,market,sector,chain,position,summary,moat,catalyst,risk,color) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(...x)));
    await db.batch(seedRelations.map(x => db.prepare("INSERT INTO relations (source_id,target_id,type,note) VALUES (?,?,?,?)").bind(...x)));
  }
  await seedExpandedMarketData();
  await db.prepare(`CREATE TABLE IF NOT EXISTS factor_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL,
    metric TEXT NOT NULL, value REAL NOT NULL, unit TEXT NOT NULL DEFAULT '',
    reporting_period TEXT NOT NULL, published_at TEXT NOT NULL, observed_at TEXT NOT NULL,
    source_document_id INTEGER NOT NULL, confidence INTEGER NOT NULL DEFAULT 3,
    created_at TEXT NOT NULL DEFAULT '', UNIQUE(company_id,metric,reporting_period,observed_at)
  )`).run();
}
async function all() {
  const [companies, relations, memberships, tags, exposures, stages, relationMeta, evidence, relationEvidence, drivers, driverImpacts, scenarios, documents, facts, driverFactLinks, factorMetrics] = await Promise.all([
    env.DB.prepare("SELECT * FROM companies ORDER BY id").all(),
    env.DB.prepare("SELECT id, source_id AS sourceId, target_id AS targetId, type, note FROM relations ORDER BY id").all(),
    env.DB.prepare("SELECT id, company_id AS companyId, chain_name AS chainName, stage, stage_order AS stageOrder, role, strength, evidence, verified_at AS verifiedAt FROM company_chain_memberships ORDER BY chain_name, stage_order, company_id").all(),
    env.DB.prepare("SELECT id, company_id AS companyId, tag_type AS tagType, tag_name AS tagName, strength, evidence, verified_at AS verifiedAt FROM company_tags ORDER BY company_id, tag_type").all(),
    env.DB.prepare("SELECT id, company_id AS companyId, factor, direction, sensitivity, evidence, verified_at AS verifiedAt FROM macro_exposures ORDER BY company_id, factor").all(),
    env.DB.prepare("SELECT id, chain_name AS chainName, stage_order AS stageOrder, stage_name AS stageName, description FROM chain_stages ORDER BY chain_name, stage_order").all(),
    env.DB.prepare("SELECT relation_id AS relationId, relation_class AS relationClass, confidence, strength, status, as_of_date AS asOfDate, analyst_note AS analystNote FROM relation_metadata ORDER BY relation_id").all(),
    env.DB.prepare("SELECT id, title, url, source_type AS sourceType, publisher, published_at AS publishedAt, accessed_at AS accessedAt, excerpt FROM evidence_sources ORDER BY id DESC").all(),
    env.DB.prepare("SELECT id, relation_id AS relationId, evidence_id AS evidenceId, support_level AS supportLevel FROM relation_evidence ORDER BY id").all(),
    env.DB.prepare("SELECT id,name,category,description,status,probability,horizon,leading_indicator AS leadingIndicator,evidence_status AS evidenceStatus,updated_at AS updatedAt FROM drivers ORDER BY probability DESC,id").all(),
    env.DB.prepare("SELECT id,driver_id AS driverId,target_type AS targetType,target_key AS targetKey,direction,strength,transmission FROM driver_impacts ORDER BY driver_id,id").all(),
    env.DB.prepare("SELECT id,name,probability,description,impact_multiplier AS impactMultiplier FROM scenarios ORDER BY id").all(),
    env.DB.prepare("SELECT id, company_id AS companyId, document_type AS documentType, title, reporting_period AS reportingPeriod, publication_date AS publicationDate, url, source_tier AS sourceTier, extraction_status AS extractionStatus FROM source_documents ORDER BY company_id, publication_date DESC").all(),
    env.DB.prepare("SELECT id, company_id AS companyId, document_id AS documentId, fact_type AS factType, label, value_text AS valueText, unit, reporting_period AS reportingPeriod, location, evidence_summary AS evidenceSummary, confidence, verified_at AS verifiedAt FROM extracted_facts ORDER BY company_id, fact_type, id").all(),
    env.DB.prepare("SELECT id, driver_id AS driverId, fact_id AS factId, stance, relevance, rationale FROM driver_fact_links ORDER BY driver_id, relevance DESC, id").all(),
    env.DB.prepare("SELECT id,company_id AS companyId,metric,value,unit,reporting_period AS reportingPeriod,published_at AS publishedAt,observed_at AS observedAt,source_document_id AS sourceDocumentId,confidence,created_at AS createdAt FROM factor_metrics ORDER BY company_id,observed_at DESC,id DESC").all(),
  ]);
  return {
    companies: companies.results, relations: relations.results, memberships: memberships.results,
    tags: tags.results, exposures: exposures.results, stages: stages.results,
    relationMeta: relationMeta.results, evidence: evidence.results, relationEvidence: relationEvidence.results,
    drivers: drivers.results, driverImpacts: driverImpacts.results, scenarios: scenarios.results,
    documents: documents.results, facts: facts.results,
    driverFactLinks: driverFactLinks.results, factorMetrics: factorMetrics.results,
  };
}
export async function GET() {
  try { await init(); return Response.json(await all()); }
  catch (e) { return Response.json({ error: e instanceof Error ? e.message : "数据库不可用" }, { status: 500 }); }
}
export async function POST(request: Request) {
  try {
    await init(); const p = await request.json() as Record<string,string>;
    if (p.kind === "relation") {
      const result = await env.DB.prepare("INSERT INTO relations (source_id,target_id,type,note) VALUES (?,?,?,?)")
        .bind(Number(p.sourceId), Number(p.targetId), p.type, p.note ?? "").run();
      const relationId = Number(result.meta.last_row_id);
      await env.DB.prepare(`INSERT INTO relation_metadata
        (relation_id,relation_class,confidence,strength,status,as_of_date,analyst_note)
        VALUES (?,?,?,?,?,?,?)`).bind(
          relationId, p.relationClass ?? "产业推断", Number(p.confidence ?? 2),
          Number(p.strength ?? 3), p.status ?? "待核验", p.asOfDate ?? "", p.analystNote ?? ""
        ).run();
      return Response.json(await all(), { status: 201 });
    }
    if (p.kind === "evidence") {
      const result = await env.DB.prepare(`INSERT INTO evidence_sources
        (title,url,source_type,publisher,published_at,accessed_at,excerpt)
        VALUES (?,?,?,?,?,?,?)`).bind(
          p.title, p.url ?? "", p.sourceType ?? "公司公告", p.publisher ?? "",
          p.publishedAt ?? "", new Date().toISOString().slice(0,10), p.excerpt ?? ""
        ).run();
      const evidenceId = Number(result.meta.last_row_id);
      if (p.relationId) {
        await env.DB.prepare("INSERT OR IGNORE INTO relation_evidence (relation_id,evidence_id,support_level) VALUES (?,?,?)")
          .bind(Number(p.relationId), evidenceId, p.supportLevel ?? "支持").run();
        await env.DB.prepare("UPDATE relation_metadata SET status='已附证据' WHERE relation_id=?")
          .bind(Number(p.relationId)).run();
      }
      return Response.json(await all(), { status: 201 });
    }
    if (p.kind === "driver") {
      const result = await env.DB.prepare(`INSERT INTO drivers
        (name,category,description,status,probability,horizon,leading_indicator,evidence_status,updated_at)
        VALUES (?,?,?,?,?,?,?,?,date('now'))`).bind(
          p.name,p.category,p.description ?? "",p.status ?? "预期",
          Number(p.probability ?? 50),p.horizon ?? "中期",p.leadingIndicator ?? "",
          p.evidenceStatus ?? "待核验"
        ).run();
      const driverId = Number(result.meta.last_row_id);
      if (p.targetKey) {
        await env.DB.prepare(`INSERT INTO driver_impacts
          (driver_id,target_type,target_key,direction,strength,transmission)
          VALUES (?,?,?,?,?,?)`).bind(
            driverId,p.targetType ?? "公司",p.targetKey,p.direction ?? "不确定",
            Number(p.strength ?? 3),p.transmission ?? ""
          ).run();
      }
      return Response.json(await all(), { status: 201 });
    }
    if (p.kind === "sourceDocument") {
      if (!p.companyId || !p.title || !p.publicationDate) return Response.json({error:"原始文件字段不完整"},{status:400});
      const existing=await env.DB.prepare("SELECT id FROM source_documents WHERE company_id=? AND title=? AND publication_date=?")
        .bind(Number(p.companyId),p.title,p.publicationDate).first<{id:number}>();
      if (!existing) await env.DB.prepare(`INSERT INTO source_documents
        (company_id,document_type,title,reporting_period,publication_date,url,source_tier,extraction_status)
        VALUES (?,?,?,?,?,?,?,?)`).bind(Number(p.companyId),p.documentType??"其他",p.title,p.reportingPeriod??"",p.publicationDate,p.url??"",p.sourceTier??"待评级",p.extractionStatus??"已核验").run();
      return Response.json(await all(), { status: existing ? 200 : 201 });
    }
    if (p.kind === "fact") {
      if (!p.companyId || !p.documentId || !p.label) return Response.json({error:"事实字段不完整"},{status:400});
      const document=await env.DB.prepare("SELECT company_id AS companyId FROM source_documents WHERE id=?").bind(Number(p.documentId)).first<{companyId:number}>();
      if (!document || document.companyId!==Number(p.companyId)) return Response.json({error:"原始文件与公司不匹配"},{status:400});
      let fact=await env.DB.prepare("SELECT id FROM extracted_facts WHERE company_id=? AND document_id=? AND label=? AND reporting_period=?")
        .bind(Number(p.companyId),Number(p.documentId),p.label,p.reportingPeriod??"").first<{id:number}>();
      if (!fact) {
        const inserted=await env.DB.prepare(`INSERT INTO extracted_facts
          (company_id,document_id,fact_type,label,value_text,unit,reporting_period,location,evidence_summary,confidence,verified_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(Number(p.companyId),Number(p.documentId),p.factType??"研究事实",p.label,p.valueText??"",p.unit??"",p.reportingPeriod??"",p.location??"",p.evidenceSummary??"",Number(p.confidence??4),p.verifiedAt??new Date().toISOString().slice(0,10)).run();
        fact={id:Number(inserted.meta.last_row_id)};
      }
      if (p.driverId) {
        const linked=await env.DB.prepare("SELECT id FROM driver_fact_links WHERE driver_id=? AND fact_id=?").bind(Number(p.driverId),fact.id).first<{id:number}>();
        if (!linked) await env.DB.prepare(`INSERT INTO driver_fact_links
          (driver_id,fact_id,stance,relevance,rationale) VALUES (?,?,?,?,?)`).bind(Number(p.driverId),fact.id,p.stance??"支持",Number(p.relevance??3),p.rationale??"").run();
      }
      return Response.json(await all(), { status: 201 });
    }
    if (p.kind === "factorMetric") {
      if (!p.companyId || !p.metric || !p.value || !p.reportingPeriod || !p.publishedAt || !p.observedAt || !p.sourceDocumentId) return Response.json({error:"指标字段不完整"},{status:400});
      if (p.publishedAt > p.observedAt) return Response.json({error:"观察日期不能早于公开日期，否则会产生前视偏差"},{status:400});
      const document=await env.DB.prepare("SELECT company_id AS companyId,publication_date AS publicationDate FROM source_documents WHERE id=?").bind(Number(p.sourceDocumentId)).first<{companyId:number;publicationDate:string}>();
      if (!document || document.companyId!==Number(p.companyId)) return Response.json({error:"原始文件与公司不匹配"},{status:400});
      if (document.publicationDate && document.publicationDate > p.observedAt) return Response.json({error:"该文件在观察日尚未公开"},{status:400});
      await env.DB.prepare(`INSERT OR REPLACE INTO factor_metrics
        (company_id,metric,value,unit,reporting_period,published_at,observed_at,source_document_id,confidence,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))`).bind(Number(p.companyId),p.metric,Number(p.value),p.unit??"",p.reportingPeriod,p.publishedAt,p.observedAt,Number(p.sourceDocumentId),Number(p.confidence??3)).run();
      return Response.json(await all(),{status:201});
    }
    await env.DB.prepare("INSERT INTO companies (name,ticker,market,sector,chain,position,summary,moat,catalyst,risk,color) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(p.name,p.ticker,p.market,p.sector,p.chain,p.position,p.summary,p.moat,p.catalyst,p.risk,p.color).run();
    return Response.json(await all(), { status: 201 });
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : "保存失败" }, { status: 500 }); }
}
export async function PUT(request: Request) {
  try {
    await init(); const p = await request.json() as Record<string,string|number>;
    await env.DB.prepare("UPDATE companies SET name=?,ticker=?,market=?,sector=?,chain=?,position=?,summary=?,moat=?,catalyst=?,risk=?,color=? WHERE id=?")
      .bind(p.name,p.ticker,p.market,p.sector,p.chain,p.position,p.summary,p.moat,p.catalyst,p.risk,p.color,p.id).run();
    return Response.json(await all());
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : "保存失败" }, { status: 500 }); }
}
