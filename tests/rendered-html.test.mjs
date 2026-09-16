import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contains the finished market atlas", async () => {
  const [page, layout, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const navigation = await readFile(new URL('../app/workspace/navigation.mjs', import.meta.url), 'utf8');
  for (const label of ['今日工作台', '研究中心', '策略实验室', '模拟组合']) assert.ok(navigation.includes(label));
  assert.match(page, /ResearchCenter/);
  assert.match(page, /StrategyWorkspace/);
  assert.doesNotMatch(page, /setData\(seed\)|view === "chain"/);
  assert.match(layout, /市场图谱/);
  assert.match(layout, /og\.png/);
  assert.match(css, /--lime:#b9f36b/);
  assert.doesNotMatch(page + layout, /codex-preview|SkeletonPreview/);
});
