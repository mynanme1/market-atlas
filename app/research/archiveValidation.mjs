export function parseArchive(text,contract){
  if(new TextEncoder().encode(text).byteLength>8*1024*1024)throw new Error('单个资料文件不能超过8MB');
  const data=JSON.parse(text);let nodes=0;
  function safe(value,depth=0){
    if(++nodes>250000||depth>40)throw new Error('资料结构过大或嵌套过深');
    if(typeof value==='number'&&!Number.isFinite(value))throw new Error('存在无效数值');
    if(value&&typeof value==='object')for(const [key,child]of Object.entries(value)){
      if(['__proto__','constructor','prototype'].includes(key))throw new Error('不允许的资料字段');
      if(/url$/i.test(key)&&typeof child==='string'&&child){
        let url;try{url=new URL(child);}catch{throw new Error('资料链接不是有效URL');}
        if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('资料链接协议或凭据不受支持');
      }
      safe(child,depth+1);
    }
  }
  safe(data);
  function matches(value,s){
    if(s.kind==='unknown')return true;
    if(s.kind==='null')return value===null;
    if(s.kind==='union')return s.members.some(m=>matches(value,m));
    if(s.kind==='array')return Array.isArray(value)&&value.every(v=>matches(v,s.item));
    if(s.kind==='object')return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(s.fields).every(([key,f])=>Object.hasOwn(value,key)?matches(value[key],f.shape):f.optional);
    return typeof value===s.kind;
  }
  if(!matches(data,contract))throw new Error('资料字段与当前档案格式不符，未加载');
  return data;
}
