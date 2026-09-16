"use client";
import {Component,createContext,useContext,useState,type ReactNode} from "react";
import contracts from "./research/archive-contracts.json";
import {parseArchive} from "./research/archiveValidation.mjs";
export type ArchiveBundle=Record<string,unknown>;
const ArchiveContext=createContext<{data:ArchiveBundle;revision:number}>({data:{},revision:0});
const styles={padding:"14px 20px",fontSize:"16px",lineHeight:1.7,borderBottom:"1px solid #ccd8ce",background:"#f2f6f3",color:"#213c2b"};
export function ResearchArchiveProvider({children}:{children:ReactNode}){
  const [state,setState]=useState({data:{} as ArchiveBundle,revision:0}),[message,setMessage]=useState("");
  async function load(files:FileList|null){
    if(!files)return;
    const accepted:ArchiveBundle={},errors:string[]=[];
    for(const file of Array.from(files)){
      try{
        if(!Object.hasOwn(contracts,file.name))throw new Error('不是本版本支持的档案文件名');
        if(file.size>8*1024*1024)throw new Error('超过8MB');
        accepted[file.name]=parseArchive(await file.text(),contracts[file.name as keyof typeof contracts]);
      }catch(error){errors.push(`${file.name}：${error instanceof Error?error.message:'读取失败'}`);}
    }
    setState(previous=>({data:{...previous.data,...accepted},revision:previous.revision+1}));
    setMessage(`加载${Object.keys(accepted).length}份资料。${errors.join('；')}`);
  }
  return <ArchiveContext.Provider value={state}>
    <aside style={styles} aria-label="开源版资料边界">
      <strong>开源研究版</strong> · 内置公司与观点为结构示例，不是最新事实或投资建议。账户仅为本地模拟。
      <details><summary>加载自己的历史研究档案（仅当前浏览器内存）</summary>
        <p>选择合法取得的原格式 JSON，文件不会上传到服务器或 GitHub；刷新页面会清除。导入资料中的结论仍属于原实验，不能当作今天的判断。</p>
        <input type="file" accept=".json,application/json" multiple aria-label="导入历史研究JSON" onChange={event=>void load(event.target.files)}/>
        <p role="status">{message||`当前加载 ${Object.keys(state.data).length} 份档案`}</p>
        <button type="button" onClick={()=>{setState(s=>({data:{},revision:s.revision+1}));setMessage('已清除浏览器内存中的档案，原文件未删除');}}>清除已加载档案</button>
      </details>
    </aside>{children}
  </ArchiveContext.Provider>;
}
class ArchiveRenderGuard extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<p role="alert">资料虽通过字段检查，但内容无法匹配此实验视图。请检查案例、版本及非空记录；未产生交易。</p>:this.props.children;}
}
export function ResearchArchiveBoundary({files,children}:{files:string[];children:(archives:ArchiveBundle)=>ReactNode}){
  const {data:archives,revision}=useContext(ArchiveContext),missing=files.filter(file=>!Object.hasOwn(archives,file));
  if(missing.length)return <section className="cyclePanel"><h3>历史研究档案未导入</h3><p>开源发行版不附带维护者的个人回测与第三方行情。可在页面顶部加载以下格式的合法档案；资料缺失不代表策略收益为零。</p><ul>{missing.map(file=><li key={file}><code>{file}</code></li>)}</ul></section>;
  return <ArchiveRenderGuard key={revision}><ArchiveContent archives={archives} render={children}/></ArchiveRenderGuard>;
}
function ArchiveContent({archives,render}:{archives:ArchiveBundle;render:(value:ArchiveBundle)=>ReactNode}){return render(archives);}
