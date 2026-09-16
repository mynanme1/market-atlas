import { env } from "cloudflare:workers";

const companies = [
  ["阿斯麦","ASML","美股/欧股","信息技术","半导体","光刻设备","先进光刻系统、软件与服务供应商","EUV技术、研发积累与客户协同","先进制程扩产与High-NA导入","出口管制与客户资本开支周期","#5ec5b3"],
  ["应用材料","AMAT","美股","信息技术","半导体","晶圆设备","半导体材料工程与晶圆制造设备供应商","工艺覆盖、装机基础与服务收入","先进制程与存储资本开支恢复","设备周期与出口限制","#6bb7d6"],
  ["美光科技","MU","美股","信息技术","半导体","HBM与存储","DRAM、NAND及高带宽存储制造商","存储工艺、规模制造和客户认证","HBM渗透率与AI服务器需求","存储价格周期与扩产过快","#9d8df1"],
  ["博通","AVGO","美股","信息技术","AI算力","网络芯片","数据中心网络与定制加速芯片供应商","高速网络、定制芯片与软件组合","AI网络升级与定制ASIC需求","客户集中与并购整合","#789bd8"],
  ["Arista Networks","ANET","美股","信息技术","AI算力","数据中心交换机","云数据中心高速网络设备商","网络操作系统、客户关系与产品迭代","AI集群以太网升级","大客户集中与技术路线竞争","#5ca9cc"],
  ["超微电脑","SMCI","美股","信息技术","AI算力","AI服务器","高密度AI服务器与机架级系统厂商","快速定制、交付速度与产品组合","GPU平台更新和机架级液冷需求","供应链、治理与竞争风险","#6f91df"],
  ["维谛技术","VRT","美股","工业","数据中心","供电与液冷","数据中心电源、热管理与基础设施方案商","工程经验、服务网络与系统集成","高功率机柜和液冷渗透","订单兑现、供应链与估值波动","#56b88e"],
  ["伊顿","ETN","美股","工业","数据中心","配电设备","电气化、配电与电能质量设备供应商","渠道、产品组合与认证壁垒","数据中心和电网资本开支","产能扩张与工业周期","#83ad6f"],
  ["施耐德电气","SU.PA","欧股","工业","数据中心","能效与配电","能源管理、自动化及数据中心基础设施厂商","软硬件整合、渠道和全球客户基础","电气化、能效与数据中心建设","工业周期、汇率与项目执行","#68b69d"],
  ["新易盛","300502","A股","通信","AI算力","光模块","高速光模块研发和制造企业","高速产品迭代、客户认证与交付","800G/1.6T产品放量","客户集中、价格与技术变化","#5faee6"],
  ["沪电股份","002463","A股","电子","AI算力","高端PCB","通信与数据中心高端印制电路板企业","高层数板工艺、客户认证与良率","AI交换机和服务器PCB升级","原料波动、扩产与客户集中","#73a8d8"],
  ["浪潮信息","000977","A股","计算机","AI算力","AI服务器","服务器及算力基础设施供应商","产品体系、交付和行业客户覆盖","国产算力建设与服务器需求","供应链限制与行业竞争","#758ddd"],
  ["中科曙光","603019","A股","计算机","AI算力","算力基础设施","高性能计算、服务器与数据中心解决方案商","高性能计算积累和行业客户基础","国产算力与智算中心建设","供应链、回款和竞争","#8b91d8"],
  ["海光信息","688041","A股","电子","半导体","CPU与加速器","国产高端处理器与协处理器设计企业","指令集生态、研发和国产替代位置","信创与国产算力需求","研发投入、生态建设与供应链","#9988dc"],
  ["宝信软件","600845","A股","计算机","数据中心","IDC与工业软件","工业软件、云服务和数据中心运营商","工业客户、园区资源与运营经验","IDC上架和工业数字化","资本开支、上架率与客户集中","#5cae9d"],
  ["国电南瑞","600406","A股","电力设备","能源电力","电网自动化","电网自动化、继电保护与调度系统企业","技术标准、客户关系与系统经验","新型电力系统和特高压投资","电网投资节奏与项目回款","#66a77a"],
  ["中国广核","003816","A股/H股","公用事业","能源电力","核电运营","核电站建设、运营及清洁能源平台","牌照、项目储备与运营经验","在建机组投产和新项目核准","建设安全、电价与利用小时","#e9aa4e"],
  ["中广核矿业","1164","港股","能源","能源资源","铀资源","天然铀资源投资与贸易平台","股东背景、资源获取与贸易渠道","铀价与核电装机增长","商品价格、项目与地缘风险","#c79a62"],
  ["华能水电","600025","A股","公用事业","能源电力","水电运营","大型流域水电开发与运营商","低成本水电资源和流域调度","来水改善、电价与新项目投产","来水波动与电价政策","#64a9b3"],
];

const relations = [
  ["ASML","TSM","供应链","光刻设备支持先进制程制造"],
  ["AMAT","TSM","供应链","晶圆制造设备与工艺投入"],
  ["TSM","NVDA","晶圆代工","先进制程与先进封装"],
  ["MU","NVDA","供应链","HBM需求与AI加速平台协同"],
  ["NVDA","SMCI","供应链","GPU平台进入AI服务器系统"],
  ["NVDA","000977","产业传导","AI芯片带动服务器系统需求"],
  ["688041","603019","产业传导","国产处理器与算力系统协同"],
  ["NVDA","300308","需求传导","AI集群推动高速光互联"],
  ["NVDA","300502","需求传导","AI集群推动高速光互联"],
  ["AVGO","ANET","产业传导","网络芯片与高速交换设备升级"],
  ["002463","ANET","产业传导","高速交换机带动高端PCB需求"],
  ["ANET","300308","竞争/替代","网络升级中的不同设备环节"],
  ["VRT","600845","产业传导","供电和热管理支撑数据中心扩容"],
  ["ETN","600845","产业传导","配电设备支撑数据中心建设"],
  ["SU.PA","600845","产业传导","能效与配电系统支撑数据中心"],
  ["600406","600845","产业传导","电网与供电基础设施支撑IDC"],
  ["601899","600406","原料传导","铜需求受电网投资拉动"],
  ["601899","600875","原料传导","工业金属影响大型装备成本"],
  ["600875","601985","供应链","核电主设备与工程服务"],
  ["600875","003816","供应链","核电主设备与工程服务"],
  ["1164","601985","原料传导","铀资源价格影响核燃料成本"],
  ["1164","003816","原料传导","铀资源价格影响核燃料成本"],
  ["601985","NVDA","主题关联","AI数据中心长期电力需求"],
  ["600025","600845","主题关联","绿色电力与数据中心用能"],
  ["300308","300502","竞争关系","高速光模块市场竞争"],
  ["000977","603019","竞争关系","服务器与算力基础设施竞争"],
  ["003816","601985","竞争/对标","核电运营资产与项目储备对标"],
];

const chainMemberships = [
  ["ASML","半导体","设备与材料",1,"核心","光刻设备是晶圆制造前置环节"],
  ["AMAT","半导体","设备与材料",1,"核心","晶圆制造设备与材料工程"],
  ["TSM","半导体","晶圆制造",2,"核心","先进制程晶圆代工"],
  ["MU","半导体","存储制造",3,"核心","DRAM、NAND与HBM"],
  ["NVDA","半导体","芯片设计",2,"核心","GPU与加速计算芯片设计"],
  ["AVGO","半导体","芯片设计",2,"核心","网络与定制加速芯片"],
  ["688041","半导体","芯片设计",2,"核心","国产CPU与协处理器"],
  ["TSM","AI算力","芯片制造",1,"核心","AI芯片制造与先进封装"],
  ["MU","AI算力","高带宽存储",2,"核心","HBM支撑AI加速器"],
  ["NVDA","AI算力","AI芯片",2,"核心","训练与推理加速平台"],
  ["AVGO","AI算力","网络芯片",2,"核心","高速网络与定制ASIC"],
  ["002463","AI算力","高端PCB",3,"配套","交换机与服务器PCB"],
  ["SMCI","AI算力","AI服务器",3,"核心","机架级AI服务器系统"],
  ["000977","AI算力","AI服务器",3,"核心","服务器与算力基础设施"],
  ["603019","AI算力","算力系统",3,"核心","高性能计算与服务器"],
  ["688041","AI算力","国产芯片",2,"核心","国产CPU与加速器"],
  ["ANET","AI算力","数据中心网络",4,"核心","高速以太网交换设备"],
  ["300308","AI算力","高速光互联",4,"核心","高速光模块"],
  ["300502","AI算力","高速光互联",4,"核心","高速光模块"],
  ["600845","AI算力","智算中心运营",5,"应用","数据中心运营与云服务"],
  ["NVDA","数据中心","计算设备",2,"核心","GPU加速计算平台"],
  ["SMCI","数据中心","服务器系统",2,"核心","服务器与机架级系统"],
  ["ANET","数据中心","网络设备",3,"核心","数据中心交换机"],
  ["300308","数据中心","光互联",3,"配套","高速光模块"],
  ["300502","数据中心","光互联",3,"配套","高速光模块"],
  ["VRT","数据中心","供电与液冷",2,"核心","电源和热管理基础设施"],
  ["ETN","数据中心","配电设备",1,"核心","配电与电能质量设备"],
  ["SU.PA","数据中心","能效与配电",1,"核心","能源管理与自动化"],
  ["600406","数据中心","电网接入",1,"配套","电网自动化与调度"],
  ["600845","数据中心","IDC运营",4,"核心","数据中心建设与运营"],
  ["600025","数据中心","绿色电力",1,"主题","水电提供低碳电力"],
  ["601899","能源电力","铜资源",1,"上游","铜是电网与电气设备原料"],
  ["600875","能源电力","发电设备",2,"核心","大型发电与核电装备"],
  ["600406","能源电力","电网设备",2,"核心","电网自动化与调度系统"],
  ["601985","能源电力","电源运营",3,"核心","核电运营"],
  ["003816","能源电力","电源运营",3,"核心","核电运营"],
  ["600025","能源电力","电源运营",3,"核心","水电运营"],
  ["1164","核电","铀资源",1,"上游","天然铀资源投资与贸易"],
  ["600875","核电","核电设备",2,"核心","核电主设备与工程服务"],
  ["601985","核电","核电运营",3,"核心","核电项目建设与运营"],
  ["003816","核电","核电运营",3,"核心","核电项目建设与运营"],
  ["601899","能源资源","铜金资源",1,"核心","铜金资源开发"],
  ["1164","能源资源","铀资源",1,"核心","天然铀资源投资与贸易"],
];

const tags = [
  ["NVDA","概念","生成式AI",5],["NVDA","风格","科技成长",5],
  ["601985","概念","绿色电力",4],["601985","风格","高股息",4],["601985","风格","央企",5],
  ["003816","概念","核电",5],["003816","风格","高股息",4],
  ["600025","概念","绿色电力",5],["600025","风格","高股息",4],
  ["300308","概念","高速光模块",5],["300502","概念","高速光模块",5],
  ["VRT","概念","液冷",5],["600406","概念","新型电力系统",5],
  ["688041","概念","国产替代",5],["603019","概念","国产算力",5],
];

const macroExposures = [
  ["601899","铜价","正向","高"],["1164","铀价","正向","高"],
  ["601985","利率","负向","中"],["003816","利率","负向","中"],
  ["NVDA","云厂商资本开支","正向","高"],["300308","云厂商资本开支","正向","高"],
  ["300502","云厂商资本开支","正向","高"],["VRT","数据中心资本开支","正向","高"],
  ["TSM","半导体资本开支周期","正向","高"],["ASML","半导体资本开支周期","正向","高"],
];

const chainStages = [
  ["半导体",1,"设备与材料","光刻、沉积、刻蚀、材料与EDA"],
  ["半导体",2,"晶圆制造","先进制程、成熟制程与晶圆代工"],
  ["半导体",3,"芯片与存储","逻辑芯片、存储与定制芯片"],
  ["半导体",4,"封装测试","先进封装、测试与交付"],
  ["AI算力",1,"芯片制造与存储","晶圆制造、先进封装和HBM"],
  ["AI算力",2,"AI芯片","GPU、CPU、加速器与网络芯片"],
  ["AI算力",3,"服务器与PCB","服务器、机架及高端PCB"],
  ["AI算力",4,"网络互联","交换机、光模块与高速互联"],
  ["AI算力",5,"供电与液冷","配电、UPS、液冷与热管理"],
  ["AI算力",6,"数据中心与应用","IDC、云计算和行业应用"],
  ["数据中心",1,"电力接入","电源、电网接入与绿色电力"],
  ["数据中心",2,"供配电","变配电、UPS与能效管理"],
  ["数据中心",3,"计算与网络","服务器、芯片、交换机和光互联"],
  ["数据中心",4,"制冷与热管理","风冷、液冷和热管理系统"],
  ["数据中心",5,"IDC运营","建设、上架、运维和云服务"],
  ["能源电力",1,"资源与原料","铜、铀及能源资源"],
  ["能源电力",2,"发电与电网设备","主设备、自动化和输配电"],
  ["能源电力",3,"发电运营","核电、水电及其他电源运营"],
  ["能源电力",4,"电网消纳","输电、调度、交易与负荷"],
  ["核电",1,"铀资源与燃料","天然铀、转化、浓缩与核燃料"],
  ["核电",2,"核电设备","核岛、常规岛和辅助系统"],
  ["核电",3,"建设与运营","项目建设、机组运营和检修"],
  ["核电",4,"并网与消纳","电网接入、电价和利用小时"],
  ["能源资源",1,"勘探与资源获取","矿权、储量和资源并购"],
  ["能源资源",2,"开采与选冶","采矿、选矿和冶炼"],
  ["能源资源",3,"贸易与定价","长协、现货和库存"],
  ["能源资源",4,"加工与应用","电网、装备和终端需求"],
];

const drivers = [
  ["云厂商AI资本开支扩张","需求","全球云厂商继续增加AI服务器、网络和数据中心投入","进行中",75,"中期","云厂商资本开支、GPU交付量、IDC上架率","待持续核验"],
  ["先进制程出口管制收紧","政策","先进芯片、设备和供应链受到更严格的区域限制","预期",45,"中期","监管清单、许可证、公司区域收入","待核验"],
  ["HBM阶段性供给紧张","产能","高带宽存储需求增速快于有效产能释放","进行中",60,"短期","HBM价格、交付周期、产能利用率","部分核验"],
  ["铜价持续上行","价格","电网、数据中心和新能源需求推升铜价与加工成本","预期",55,"短期","LME铜价、库存、冶炼费、设备毛利率","待核验"],
  ["核电项目核准提速","政策","新增核电项目核准和开工节奏加快","进行中",65,"长期","年度核准机组、设备招标、在建装机","部分核验"],
  ["天然铀价格上涨","价格","核电装机增长与供给约束推动铀价上行","进行中",60,"中期","现货铀价、长协价、矿山产量","待核验"],
  ["利率中枢下降","宏观","融资成本下降并改善长久期资产估值","预期",50,"中期","国债收益率、信用利差、融资成本","待核验"],
  ["液冷渗透率提升","技术","高功率AI机柜推动液冷从选配走向标准配置","进行中",75,"中期","单柜功率、液冷订单、冷板与CDU出货","部分核验"],
  ["电网资本开支增长","需求","新型电力系统和负荷增长推动输配电投资","进行中",70,"长期","电网投资额、招标量、特高压核准","部分核验"],
  ["AI服务器阶段性供给过剩","产能","扩产速度快于终端需求兑现导致库存和价格压力","预期",35,"中期","渠道库存、服务器价格、订单取消率","待核验"],
];

const driverImpacts = [
  [0,"公司","NVDA","利好",5,"需求增长首先传导至AI芯片与加速平台"],
  [0,"公司","TSM","利好",4,"AI芯片订单带动先进制程和封装需求"],
  [0,"公司","300308","利好",4,"集群规模扩大提高高速光互联需求"],
  [0,"公司","VRT","利好",4,"数据中心扩建带动供电和热管理投入"],
  [0,"产业链","数据中心","利好",5,"建设、上架和基础设施需求增长"],
  [1,"公司","NVDA","利空",4,"可服务市场和产品交付受到限制"],
  [1,"公司","ASML","利空",3,"部分区域设备销售和服务受限"],
  [1,"公司","688041","利好",3,"国产替代需求可能上升，但供应链仍受约束"],
  [2,"公司","MU","利好",5,"紧缺有助于价格、产品组合和产能利用率"],
  [2,"公司","SMCI","利空",3,"关键存储供应不足可能限制整机交付"],
  [3,"公司","601899","利好",5,"资源售价上升改善矿山盈利弹性"],
  [3,"公司","600406","利空",3,"铜材料成本上升可能压缩设备利润"],
  [3,"公司","ETN","利空",2,"原材料成本上升，影响程度取决于转嫁能力"],
  [4,"公司","600875","利好",5,"新增项目直接带动核电设备订单"],
  [4,"公司","601985","利好",4,"长期项目储备和装机规模增加"],
  [4,"公司","003816","利好",4,"长期项目储备和装机规模增加"],
  [5,"公司","1164","利好",5,"铀资源价格上升增强资源端盈利弹性"],
  [5,"公司","601985","利空",2,"燃料成本上升，但长协和成本占比形成缓冲"],
  [6,"公司","601985","利好",3,"融资成本下降有利于资本密集型运营商"],
  [6,"公司","600845","利好",3,"数据中心融资与估值压力缓解"],
  [7,"公司","VRT","利好",5,"液冷设备和系统集成需求提升"],
  [7,"公司","300308","利好",2,"高功率集群扩容与网络升级同步发生"],
  [8,"公司","600406","利好",5,"电网自动化和调度系统订单增长"],
  [8,"公司","601899","利好",3,"电网建设增加铜需求"],
  [9,"公司","SMCI","利空",4,"库存、价格和毛利率承压"],
  [9,"公司","000977","利空",4,"行业供给增加导致竞争和价格压力"],
];

const scenarios = [
  ["基准情景",55,"AI资本开支维持增长，液冷和电网投资稳步推进，政策与供应链约束保持现状",1.0],
  ["乐观情景",25,"AI需求超预期、利率下降、核电与电网项目加速，关键产能有序释放",1.25],
  ["压力情景",20,"出口限制收紧、服务器库存上升、原材料成本上行且资本开支放缓",0.7],
];

const sourceDocuments = [
  ["NVDA","10-K","NVIDIA Fiscal 2026 Annual Report","FY2026","2026-02-25","https://investor.nvidia.com/financial-info/sec-filings/sec-filings-details/default.aspx?FilingId=19184805","一级法定披露","已核验"],
  ["NVDA","业绩公告","NVIDIA FY2027 Q1 Results","FY2027 Q1","2026-05-20","https://investor.nvidia.com/financial-info/financial-reports/default.aspx","二级公司官方","已核验"],
  ["VRT","10-K","Vertiv 2025 Form 10-K","FY2025","2026-02-13","https://www.sec.gov/Archives/edgar/data/1674101/000167410126000008/vrt-20251231.htm","一级法定披露","已核验"],
  ["VRT","业绩公告","Vertiv Fourth Quarter and Full Year 2025 Results","FY2025","2026-02-11","https://investors.vertiv.com/news/news-details/2026/Vertiv-Reports-Strong-Fourth-Quarter-with-Organic-Orders-Growth-of-252-and-Diluted-EPS-Growth-of-200-Adjusted-Diluted-EPS-37/","二级公司官方","已核验"],
  ["601985","可持续发展报告","中国核电2024年度可持续发展报告","FY2024","2025-06-17","https://www.cnnp.com.cn/cnnp/resource/cms/article/1278687/5e8397b7c6c14e31b3db32a8a0227579/2025061716594725168.pdf","二级公司官方","已核验"],
  ["600875","半年度报告","东方电气2025年半年度报告","2025H1","2025-08-29","https://www.dec-ltd.cn/dongfangdianqigufenyouxiangongsi2025nianbanniandubaogao.pdf","一级法定披露","待提取"],
  ["600875","公司简介","东方电气集团简介","当前资料","2025-02-20","https://www.dec-ltd.cn/info/1003/11505.htm","二级公司官方","已核验"],
];

const extractedFacts = [
  ["NVDA","NVIDIA FY2027 Q1 Results","财务指标","营业收入","81.6","十亿美元","FY2027 Q1","最新报告摘要","公司披露季度收入为81.6十亿美元，同比增长85%。",5],
  ["NVDA","NVIDIA FY2027 Q1 Results","业务指标","数据中心收入","75.2","十亿美元","FY2027 Q1","最新报告摘要","数据中心收入为75.2十亿美元，同比增长92%。",5],
  ["NVDA","NVIDIA Fiscal 2026 Annual Report","风险因素","外包制造依赖","","","FY2026","风险因素","公司依赖第三方制造、组装、封装和测试产品。",5],
  ["VRT","Vertiv Fourth Quarter and Full Year 2025 Results","财务指标","营业收入","10.2299","十亿美元","FY2025","合并利润表","2025年产品与服务合计净销售额为102.299亿美元。",5],
  ["VRT","Vertiv Fourth Quarter and Full Year 2025 Results","经营指标","期末积压订单","15.0","十亿美元","FY2025 Q4","业绩摘要","2025年第四季度末积压订单升至150亿美元。",5],
  ["VRT","Vertiv Fourth Quarter and Full Year 2025 Results","经营指标","订单出货比","2.9","倍","FY2025 Q4","业绩摘要","第四季度book-to-bill约为2.9倍。",5],
  ["VRT","Vertiv 2025 Form 10-K","业务事实","核心业务","","","FY2025","Item 7 Overview","公司设计、制造并服务于供电、制冷、部署及维护关键数字基础设施的技术。",5],
  ["601985","中国核电2024年度可持续发展报告","财务指标","营业收入","772.72","亿元人民币","FY2024","第5页","报告列示2024年营业收入772.72亿元。",5],
  ["601985","中国核电2024年度可持续发展报告","财务指标","归母净利润","87.77","亿元人民币","FY2024","第5页","报告列示2024年归属于上市公司股东的净利润87.77亿元。",5],
  ["601985","中国核电2024年度可持续发展报告","运营指标","控股核电在运机组","26","台","截至2025-01-01","第4页","2025年1月1日控股核电在运机组为26台。",5],
  ["601985","中国核电2024年度可持续发展报告","运营指标","核电装机容量","2496.20","万千瓦","截至2025-01-01","第4页","控股核电在运装机容量为2496.20万千瓦。",5],
  ["600875","东方电气集团简介","业务事实","发电设备能力","","","当前资料","集团简介","具备水电、火电、核电、气电、风电及太阳能发电设备的开发、设计和制造能力。",4],
  ["600875","东方电气集团简介","运营指标","累计生产发电设备","8","亿千瓦以上","截至2025-02-20","集团简介","累计生产发电设备超过8亿千瓦。",4],
  ["600875","东方电气集团简介","市场覆盖","出口国家和地区","近110","个","截至2025-02-20","集团简介","产品和服务出口到近110个国家和地区。",4],
];

const driverFactLinks = [
  [0,"NVDA","数据中心收入","支持",5,"数据中心收入高增长为AI资本开支需求提供结果侧验证"],
  [0,"VRT","期末积压订单","支持",5,"高积压订单反映数据中心基础设施需求尚未完全交付"],
  [0,"VRT","订单出货比","支持",5,"订单增速显著高于当期出货，支持需求景气判断"],
  [1,"NVDA","外包制造依赖","相关背景",3,"供应链依赖会放大政策和区域限制的交付影响，但不直接证明管制收紧"],
  [4,"601985","核电装机容量","相关背景",3,"现有装机证明运营基础，新增核准仍需政策文件单独验证"],
  [4,"600875","发电设备能力","相关背景",3,"公司具备承接核电设备需求的能力，但尚缺上市公司订单数据"],
  [7,"VRT","核心业务","支持",4,"公司业务范围覆盖关键数字基础设施供电与制冷"],
  [7,"VRT","期末积压订单","相关背景",3,"订单景气与液冷需求方向一致，但披露未单独拆分液冷订单"],
] as const;

export async function seedExpandedMarketData() {
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS company_chain_memberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL,
      chain_name TEXT NOT NULL, stage TEXT NOT NULL, stage_order INTEGER NOT NULL,
      role TEXT NOT NULL, strength INTEGER NOT NULL DEFAULT 3,
      evidence TEXT NOT NULL DEFAULT '', verified_at TEXT NOT NULL DEFAULT '',
      UNIQUE(company_id, chain_name, stage)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS company_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL,
      tag_type TEXT NOT NULL, tag_name TEXT NOT NULL, strength INTEGER NOT NULL DEFAULT 3,
      evidence TEXT NOT NULL DEFAULT '', verified_at TEXT NOT NULL DEFAULT '',
      UNIQUE(company_id, tag_type, tag_name)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS macro_exposures (
      id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL,
      factor TEXT NOT NULL, direction TEXT NOT NULL, sensitivity TEXT NOT NULL,
      evidence TEXT NOT NULL DEFAULT '', verified_at TEXT NOT NULL DEFAULT '',
      UNIQUE(company_id, factor)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS chain_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, chain_name TEXT NOT NULL,
      stage_order INTEGER NOT NULL, stage_name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      UNIQUE(chain_name, stage_order)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS relation_metadata (
      relation_id INTEGER PRIMARY KEY, relation_class TEXT NOT NULL DEFAULT '产业推断',
      confidence INTEGER NOT NULL DEFAULT 2, strength INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT '待核验', as_of_date TEXT NOT NULL DEFAULT '',
      analyst_note TEXT NOT NULL DEFAULT ''
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS evidence_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL, publisher TEXT NOT NULL DEFAULT '',
      published_at TEXT NOT NULL DEFAULT '', accessed_at TEXT NOT NULL DEFAULT '',
      excerpt TEXT NOT NULL DEFAULT '', UNIQUE(title, url)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS relation_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT, relation_id INTEGER NOT NULL,
      evidence_id INTEGER NOT NULL, support_level TEXT NOT NULL DEFAULT '支持',
      UNIQUE(relation_id, evidence_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL, probability INTEGER NOT NULL, horizon TEXT NOT NULL,
      leading_indicator TEXT NOT NULL DEFAULT '', evidence_status TEXT NOT NULL DEFAULT '待核验',
      updated_at TEXT NOT NULL DEFAULT ''
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS driver_impacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, driver_id INTEGER NOT NULL,
      target_type TEXT NOT NULL, target_key TEXT NOT NULL, direction TEXT NOT NULL,
      strength INTEGER NOT NULL, transmission TEXT NOT NULL DEFAULT '',
      UNIQUE(driver_id, target_type, target_key, direction)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
      probability INTEGER NOT NULL, description TEXT NOT NULL DEFAULT '',
      impact_multiplier REAL NOT NULL DEFAULT 1
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS source_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL,
      document_type TEXT NOT NULL, title TEXT NOT NULL, reporting_period TEXT NOT NULL DEFAULT '',
      publication_date TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
      source_tier TEXT NOT NULL, extraction_status TEXT NOT NULL DEFAULT '待提取',
      UNIQUE(company_id,title)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS extracted_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL,
      document_id INTEGER NOT NULL, fact_type TEXT NOT NULL, label TEXT NOT NULL,
      value_text TEXT NOT NULL DEFAULT '', unit TEXT NOT NULL DEFAULT '',
      reporting_period TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '',
      evidence_summary TEXT NOT NULL DEFAULT '', confidence INTEGER NOT NULL DEFAULT 3,
      verified_at TEXT NOT NULL DEFAULT '', UNIQUE(document_id,label,reporting_period)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS driver_fact_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT, driver_id INTEGER NOT NULL,
      fact_id INTEGER NOT NULL, stance TEXT NOT NULL DEFAULT '支持',
      relevance INTEGER NOT NULL DEFAULT 3, rationale TEXT NOT NULL DEFAULT '',
      UNIQUE(driver_id,fact_id)
    )`),
  ]);
  await db.batch(companies.map(values =>
    db.prepare(`INSERT INTO companies
      (name,ticker,market,sector,chain,position,summary,moat,catalyst,risk,color)
      SELECT ?,?,?,?,?,?,?,?,?,?,?
      WHERE NOT EXISTS (SELECT 1 FROM companies WHERE ticker = ?)`)
      .bind(...values, values[1])
  ));

  const rows = await db.prepare("SELECT id, ticker FROM companies").all<{id:number;ticker:string}>();
  const idByTicker = new Map(rows.results.map(row => [row.ticker, row.id]));
  const statements = relations.flatMap(([sourceTicker, targetTicker, type, note]) => {
    const sourceId = idByTicker.get(sourceTicker);
    const targetId = idByTicker.get(targetTicker);
    if (!sourceId || !targetId) return [];
    return [db.prepare(`INSERT INTO relations (source_id,target_id,type,note)
      SELECT ?,?,?,? WHERE NOT EXISTS (
        SELECT 1 FROM relations WHERE source_id = ? AND target_id = ? AND type = ?
      )`).bind(sourceId, targetId, type, note, sourceId, targetId, type)];
  });
  if (statements.length) await db.batch(statements);

  const membershipStatements = chainMemberships.flatMap(([ticker, chain, stage, order, role, evidence]) => {
    const companyId = idByTicker.get(String(ticker));
    if (!companyId) return [];
    return [db.prepare(`INSERT OR IGNORE INTO company_chain_memberships
      (company_id,chain_name,stage,stage_order,role,strength,evidence,verified_at)
      VALUES (?,?,?,?,?,4,?,date('now'))`).bind(companyId, chain, stage, order, role, evidence)];
  });
  if (membershipStatements.length) await db.batch(membershipStatements);

  const tagStatements = tags.flatMap(([ticker, type, name, strength]) => {
    const companyId = idByTicker.get(String(ticker));
    if (!companyId) return [];
    return [db.prepare(`INSERT OR IGNORE INTO company_tags
      (company_id,tag_type,tag_name,strength,evidence,verified_at)
      VALUES (?,?,?,?,?,date('now'))`).bind(companyId, type, name, strength, "研究示例标签，待公告或财报复核")];
  });
  if (tagStatements.length) await db.batch(tagStatements);

  const exposureStatements = macroExposures.flatMap(([ticker, factor, direction, sensitivity]) => {
    const companyId = idByTicker.get(String(ticker));
    if (!companyId) return [];
    return [db.prepare(`INSERT OR IGNORE INTO macro_exposures
      (company_id,factor,direction,sensitivity,evidence,verified_at)
      VALUES (?,?,?,?,?,date('now'))`).bind(companyId, factor, direction, sensitivity, "研究示例暴露，待量化验证")];
  });
  if (exposureStatements.length) await db.batch(exposureStatements);

  await db.batch(chainStages.map(([chain, order, name, description]) =>
    db.prepare(`INSERT OR IGNORE INTO chain_stages
      (chain_name,stage_order,stage_name,description) VALUES (?,?,?,?)`)
      .bind(chain, order, name, description)
  ));

  await db.prepare(`INSERT OR IGNORE INTO relation_metadata
    (relation_id,relation_class,confidence,strength,status,as_of_date,analyst_note)
    SELECT id,
      CASE
        WHEN type LIKE '%主题%' THEN '主题假设'
        WHEN type LIKE '%竞争%' OR type LIKE '%替代%' OR type LIKE '%对标%' THEN '竞争判断'
        WHEN type LIKE '%供应%' OR type LIKE '%代工%' THEN '业务关系'
        ELSE '产业推断'
      END,
      CASE WHEN type LIKE '%主题%' THEN 1 WHEN type LIKE '%供应%' OR type LIKE '%代工%' THEN 3 ELSE 2 END,
      3,
      '待核验','','由示例数据自动初始化'
    FROM relations`).run();

  const evidenceSeeds = [
    ["ASML公司与产品介绍","https://www.asml.com/en/company/about-asml","官方网站","ASML","光刻系统是芯片量产的重要制造设备。","ASML","TSM","间接支持"],
    ["Vertiv数据中心供电与冷却方案","https://www.vertiv.com/en-us/solutions/data-center/","官方网站","Vertiv","公司提供覆盖数据中心供电、冷却和IT基础设施的解决方案。","VRT","600845","间接支持"],
    ["中国核电公司简介","https://www.cnnp.com.cn/","官方网站","中国核电","公司业务包括核电项目开发、建设与运营。","600875","601985","间接支持"],
  ];
  for (const [title,url,type,publisher,excerpt,sourceTicker,targetTicker,support] of evidenceSeeds) {
    await db.prepare(`INSERT OR IGNORE INTO evidence_sources
      (title,url,source_type,publisher,published_at,accessed_at,excerpt)
      VALUES (?,?,?,?,?,date('now'),?)`).bind(title,url,type,publisher,"",excerpt).run();
    await db.prepare(`INSERT OR IGNORE INTO relation_evidence (relation_id,evidence_id,support_level)
      SELECT r.id,e.id,?
      FROM relations r
      JOIN companies s ON s.id=r.source_id
      JOIN companies t ON t.id=r.target_id
      JOIN evidence_sources e ON e.title=? AND e.url=?
      WHERE s.ticker=? AND t.ticker=?
      LIMIT 1`).bind(support,title,url,sourceTicker,targetTicker).run();
  }

  await db.batch(drivers.map(([name,category,description,status,probability,horizon,indicator,evidenceStatus]) =>
    db.prepare(`INSERT OR IGNORE INTO drivers
      (name,category,description,status,probability,horizon,leading_indicator,evidence_status,updated_at)
      VALUES (?,?,?,?,?,?,?,?,date('now'))`)
      .bind(name,category,description,status,probability,horizon,indicator,evidenceStatus)
  ));
  const driverRows = await db.prepare("SELECT id,name FROM drivers").all<{id:number;name:string}>();
  const driverIdByIndex = drivers.map(item => driverRows.results.find(row => row.name === item[0])?.id);
  const impactStatements = driverImpacts.flatMap(([driverIndex,targetType,targetKey,direction,strength,transmission]) => {
    const driverId = driverIdByIndex[Number(driverIndex)];
    if (!driverId) return [];
    return [db.prepare(`INSERT OR IGNORE INTO driver_impacts
      (driver_id,target_type,target_key,direction,strength,transmission)
      VALUES (?,?,?,?,?,?)`).bind(driverId,targetType,targetKey,direction,strength,transmission)];
  });
  if (impactStatements.length) await db.batch(impactStatements);
  await db.batch(scenarios.map(([name,probability,description,multiplier]) =>
    db.prepare(`INSERT OR IGNORE INTO scenarios
      (name,probability,description,impact_multiplier) VALUES (?,?,?,?)`)
      .bind(name,probability,description,multiplier)
  ));

  const documentStatements = sourceDocuments.flatMap(([ticker,type,title,period,published,url,tier,status]) => {
    const companyId = idByTicker.get(String(ticker));
    if (!companyId) return [];
    return [db.prepare(`INSERT OR IGNORE INTO source_documents
      (company_id,document_type,title,reporting_period,publication_date,url,source_tier,extraction_status)
      VALUES (?,?,?,?,?,?,?,?)`).bind(companyId,type,title,period,published,url,tier,status)];
  });
  if (documentStatements.length) await db.batch(documentStatements);
  const documentRows = await db.prepare("SELECT id,company_id,title FROM source_documents").all<{id:number;company_id:number;title:string}>();
  const factStatements = extractedFacts.flatMap(([ticker,documentTitle,factType,label,value,unit,period,location,summary,confidence]) => {
    const companyId = idByTicker.get(String(ticker));
    const document = documentRows.results.find(row => row.company_id === companyId && row.title === documentTitle);
    if (!companyId || !document) return [];
    return [db.prepare(`INSERT OR IGNORE INTO extracted_facts
      (company_id,document_id,fact_type,label,value_text,unit,reporting_period,location,evidence_summary,confidence,verified_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,date('now'))`).bind(companyId,document.id,factType,label,value,unit,period,location,summary,confidence)];
  });
  if (factStatements.length) await db.batch(factStatements);
  const factRows = await db.prepare("SELECT id,company_id,label FROM extracted_facts").all<{id:number;company_id:number;label:string}>();
  const driverFactStatements = driverFactLinks.flatMap(([driverIndex,ticker,label,stance,relevance,rationale]) => {
    const driverId = driverIdByIndex[Number(driverIndex)];
    const companyId = idByTicker.get(String(ticker));
    const fact = factRows.results.find(row => row.company_id === companyId && row.label === label);
    if (!driverId || !fact) return [];
    return [db.prepare(`INSERT OR IGNORE INTO driver_fact_links
      (driver_id,fact_id,stance,relevance,rationale) VALUES (?,?,?,?,?)`)
      .bind(driverId,fact.id,stance,relevance,rationale)];
  });
  if (driverFactStatements.length) await db.batch(driverFactStatements);
}
