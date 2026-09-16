import {readdirSync,readFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),ignored=new Set(['node_modules','.git','.wrangler','dist','.next']);
const files=[];
function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){if(entry.isSymbolicLink())throw new Error('Symlink in release');if(entry.isDirectory()){if(!ignored.has(entry.name))walk(join(dir,entry.name));}else files.push(join(dir,entry.name));}}
walk(root);const errors=[];
for(const file of files){
  const name=relative(root,file).replaceAll('\\','/');
  if(/(^|\/)(?:research-sources|research-reports|local-data|\.openai|tmp)(\/|$)|^public\/research\/|\.(?:db|sqlite\d*|pem|key|log|zip|gz)$|(^|\/)\.env/.test(name))errors.push(`${name}: private/generated data`);
  if(!/\.(ts|tsx|mjs|json|md|sql|css|yml)$/.test(name))continue;
  const text=readFileSync(file,'utf8');
  if(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{24,})\b/.test(text)||/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))errors.push(`${name}: credential pattern`);
  if(/appgprj_[a-z0-9]{12,}|[CD]:[\\/](?:Users|AI)[\\/]/.test(text))errors.push(`${name}: private identity/path`);
  if(/^import .*?(?:public\/research|research-reports).*?json/m.test(text))errors.push(`${name}: static private archive dependency`);
}
console.log(JSON.stringify({files:files.length,errors,scope:'Source allowlist check; not a complete security or copyright certification'},null,2));
if(errors.length)process.exitCode=1;
