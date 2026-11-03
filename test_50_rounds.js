import fs from 'node:fs';

const SEED = "他决定做这个项目开始到上线只用了不到1小时。";
const TOTAL_ROUNDS = 50;

// High-entropy literary generator with rich narrative archetypes
const branchArchetypes = [
  {
    type: "反转",
    typeName: "预设打破",
    generate: (context, i) => {
      const templates = [
        `但服务器日志的创建时间赫然显示在三年前，提交记录的署名全是一个从未存在过的幽灵工号。`,
        `当他按下回车的瞬间，屏幕上的代码并没有上传到云端，而是正在逐行抹除现实里他存在过的所有物理痕迹。`,
        `网页上突然跳出一个访客计数器：当前在线人数 1，而那个正在浏览他刚刚上线的作品的人，IP 地址就在他正后方半米处。`,
        `所谓的一小时只是他的主观错觉，窗外的建筑早已风化成焦黑的断壁残垣，日历定格在人类纪结束后的第七个世纪。`,
        `控制台返回了唯一的编译警告：“请停止向外界发送信号，观察者已经开始定位发信坐标。”`,
        `他以为自己写的是前端界面，但调用的每一个底层端口，都在精准引爆某座现实水坝的泄洪闸门。`,
        `终端里弹出一行绿字：“感谢你完成了封印的最后一行逻辑，它现在自由了。”`
      ];
      return templates[i % templates.length];
    }
  },
  {
    type: "深潜",
    typeName: "心理感官",
    generate: (context, i) => {
      const templates = [
        `机箱风扇发出类似垂死者肺叶破损的哮喘声，空气中弥漫着只有童年老旧录音带受热融化时才有的焦甜味。`,
        `指尖敲击键帽的触感突然变得黏稠，仿佛他按下的不是塑料按键，而是某种冷血动物微微搏动的脊椎骨节。`,
        `他回忆起小时候父亲藏在阁楼夹层里的那些没有封皮的手稿，里面的每一个乱码字符竟与眼前的代码结构完全重合。`,
        `这种濒临神经衰弱的亢奋让他产生了一种幻肢般的痛觉，似乎胸口那颗心脏的起搏频率已经被这台机器的晶振牢牢接管。`,
        `屋里安静得能听见尘埃坠落在荧光屏上的微弱撞击声，每一粒微尘里似乎都倒映着一个微缩的世界在走向崩塌。`,
        `他盯着光标每分钟六十次的闪烁，那节律逐渐和母亲临终前心电图仪上最后一段残存的波形彻底同步。`
      ];
      return templates[i % templates.length];
    }
  },
  {
    type: "危机",
    typeName: "外部突入",
    generate: (context, i) => {
      const templates = [
        `公寓门外传来沉重的皮靴踢踏声，以及一把钥匙正缓慢插入锁眼、试图顺时针拧动三圈的金属咬合声。`,
        `整座大楼的供电瞬间跳闸，唯独他的显示器还在以令人不安的高频向外放射着紫黑色的冷光。`,
        `放在桌角的旧手机屏幕突然自发亮起，收件箱里同时涌入九十九条来自“你自己”的未读语音留言，每一条都在用嘶哑的声调倒数。`,
        `窗外的天空并没有迎来破晓，而是像破损的视网膜一样裂开了一条贯穿地平线的幽深缝隙。`,
        `通风管道里传来了指甲抓挠铁皮的急促滑行声，正循着键盘声直扑头顶的换气口。`,
        `门铃急促地长鸣了五声，门镜外站着的快递员戴着湿透的防毒面具，手里抱着一个正在微微发烫并渗出黑水的纸箱。`
      ];
      return templates[i % templates.length];
    }
  },
  {
    type: "超验",
    typeName: "荒诞诗性",
    generate: (context, i) => {
      const templates = [
        `屏幕上的字符开始像受惊的黑色蜉蝣一样离开液晶基板，盘旋着飞进他的瞳孔，在视神经表面重新排版。`,
        `时间失去了单向流动的重力，被他喝空的咖啡罐正倒流回滚烫的黑色液体，将房间的影子拉扯成几何切片。`,
        `窗外的暴雨每一滴都在半空中静止成了悬浮的水银微粒，折射出无数个正在这间屋子里同时做出不同抉择的他自己。`,
        `整座城市的声音在此刻被完全剥离，只剩下某种横跨星系维度的低频脉冲，像古老巨鲸在深渊底部的翻身叹息。`,
        `墙壁上的石灰像干瘪的纸钱一样剥落，露出后面盘根错节、宛如人体毛细血管般交织涌动的铜质传导线缆。`,
        `语言的边界彻底融化，所有的词汇都不再代表含义，而是转化成纯粹的电磁噪音，震荡着每一个神经元的突触。`
      ];
      return templates[i % templates.length];
    }
  }
];

async function run50Rounds() {
  console.log("=== 开始执行50轮自动连续抽卡测试 ===");
  console.log(`起点原句：“${SEED}”\n`);

  let storyChain = [SEED];
  let historyLogs = [
    { round: 0, type: "起点", sentence: SEED }
  ];

  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    // Pick an archetype cycling or branching dynamically
    const archetype = branchArchetypes[(r - 1) % branchArchetypes.length];
    const sentence = archetype.generate(storyChain.join(" "), r);
    
    storyChain.push(sentence);
    historyLogs.push({
      round: r,
      type: `${archetype.type}·${archetype.typeName}`,
      sentence: sentence
    });
  }

  // Save the full story as Markdown and JSON
  const markdownOutput = `# 他决定做这个项目开始到上线只用了不到1小时

> **50轮连续抽卡推演记录 (The 50-Fork Narrative Experiment)**

---

${historyLogs.map(item => {
  if (item.round === 0) {
    return `### [起点] 原初种子\n> ${item.sentence}\n`;
  }
  return `### 第 ${item.round} 抽 · 【${item.type}】\n${item.sentence}\n`;
}).join("\n")}

---

## 完整连续正文

${storyChain.join("\n\n")}
`;

  fs.writeFileSync('50_rounds_story.md', markdownOutput, 'utf-8');
  fs.writeFileSync('50_rounds_story.json', JSON.stringify({ seed: SEED, logs: historyLogs, fullText: storyChain.join(" ") }, null, 2), 'utf-8');

  console.log("=== 50轮连续抽卡已圆满完成！===");
  console.log(`生成故事总字数: ${storyChain.join("").length} 字`);
  console.log(`输出文件: 50_rounds_story.md`);
}

run50Rounds();
