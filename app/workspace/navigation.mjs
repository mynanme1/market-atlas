export const sections = [
  { id: 'today', label: '今日工作台', hint: '检查资料与组合状态' },
  { id: 'research', label: '研究中心', hint: '公司、证据与产业关系' },
  { id: 'strategy', label: '策略实验室', hint: '规则、回测与实验归档' },
  { id: 'portfolio', label: '模拟组合', hint: '持仓、行情与订单' },
];
export const defaultRoute = { view: 'today', company: 0, research: 'companies', detail: 'overview', lab: 'rules', archive: 'improvement' };
const allowed = {
  view: sections.map(x => x.id),
  research: ['companies', 'network', 'drivers', 'analysis', 'evidence'],
  detail: ['overview', 'evidence', 'metrics', 'relations', 'activity'],
  lab: ['rules', 'backtest', 'factors', 'archive'],
  archive: ['improvement', 'exposure', 'v3', 'matched', 'historical', 'validation', 'suite', 'execution'],
};
export function parseRoute(hash = '') {
  const [view, query = ''] = hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const route = { ...defaultRoute };
  for (const key of Object.keys(allowed)) {
    const value = key === 'view' ? view : params.get(key);
    if (allowed[key].includes(value)) route[key] = value;
  }
  const company = Number(params.get('company'));
  if (Number.isSafeInteger(company) && company > 0) route.company = company;
  return route;
}
export function formatRoute(route) {
  const params = new URLSearchParams();
  for (const key of ['company', 'research', 'detail', 'lab', 'archive']) {
    if (route[key] !== defaultRoute[key]) params.set(key, String(route[key]));
  }
  return `#${route.view}${params.size ? '?' + params : ''}`;
}
