// Personal compressed input archives are not part of the release.
export async function GET(){
  return Response.json({error:"开源版未附私人回测输入。请运行 npm run demo:backtest 验证合成样本；真实实验需自行提供获授权、按日期冻结的数据。"},{status:409});
}
