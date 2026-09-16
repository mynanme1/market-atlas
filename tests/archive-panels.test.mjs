import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const root=fileURLToPath(new URL('../',import.meta.url));

for(const name of ['ExposureControlPanel','HistoricalCoveragePanel','HistoricalEvidencePanel','HistoricalFactorBacktestPanel','MatchedFilterBacktestPanel','NvidiaValuationPanel','StrategyImprovementPanel','V3MatchedBacktestPanel']){
  test(`${name} renders a useful empty state without private research files`,async()=>{
    const result=await build({absWorkingDir:root,entryPoints:[`app/${name}.tsx`],bundle:true,write:false,platform:'node',format:'cjs',external:['react','react/jsx-runtime'],loader:{'.css':'empty'},logLevel:'silent'});
    const module={exports:{}};
    new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);
    const html=renderToStaticMarkup(createElement(module.exports.default,{asOf:'2025-01-01',mode:'published'}));
    assert.match(html,/历史研究档案未导入/);
    assert.match(html,/资料缺失不代表策略收益为零/);
  });
}
