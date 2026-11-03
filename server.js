import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 4321;

// 客户端未传维度时使用的经典四维
const DEFAULT_DIMENSIONS = [
  { type: '反转', typeName: '预设打破', brief: '推翻读者或角色刚刚建立的认知，让这句话里最确定的事变得可疑甚至完全相反' },
  { type: '深潜', typeName: '感官印记', brief: '停在此刻，放大一个具体的感官细节，让它牵出情绪或记忆' },
  { type: '危机', typeName: '外部突入', brief: '一个外部的人、声音或事件突然闯入，打断当下并制造紧迫威胁' },
  { type: '超验', typeName: '荒诞诗性', brief: '以不讲道理却精确的诗性逻辑改写现实，让日常裂开一道超现实的口子' }
];

const SYSTEM_PROMPT = `你是一个专注小说与剧本叙事可能性的"裂变引擎"。写作者会给你前文、光标前的最后一句（锚点句）、可能存在的后文，以及本次指定的若干戏剧张力维度。
针对每一个维度，各写一个紧接锚点句之后的发展方向。要求：
1. 扎根前文：沿用已有的人物、人称、时态、叙述视角与文体，不引入与前文矛盾的设定；如果有后文，接续要能自然衔接过去。
2. 每个方向必须真正体现它被指定的维度，彼此差异鲜明，不要写成同一件事的几种说法。
3. 拒绝陈词滥调和最容易想到的走向：具体胜于抽象，画面胜于概括。
4. sentence 是可以直接放进正文、紧跟锚点句的一到两句话，不重复锚点句，不加引号或任何解释。
5. tensionTitle 是你为这个方向起的 2 到 8 字核心意象标题，必须针对本句的具体内容，不要照抄维度名。
6. 使用与前文相同的语言写作。
不要写任何前言或客套话，只输出纯净合法的 JSON，不要用 markdown 包裹。branches 的数量与顺序必须与给出的维度一一对应：
{"branches":[{"tensionTitle":"……","sentence":"……"}]}`;

const clip = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const normalizeDimensions = (dims) => {
  if (!Array.isArray(dims)) return DEFAULT_DIMENSIONS;
  const list = dims.slice(0, 6)
    .map(d => ({ type: clip(d?.type, 8), typeName: clip(d?.typeName, 12), brief: clip(d?.brief, 120) }))
    .filter(d => d.type && d.typeName);
  return list.length > 0 ? list : DEFAULT_DIMENSIONS;
};

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

const buildUserMessage = ({ sentence, contextBefore, contextAfter, title, dimensions }) => {
  const parts = [];
  if (title) parts.push(`【文稿标题】${title}`);
  parts.push(`【前文】\n${contextBefore || '（无，锚点句就是开篇第一句）'}`);
  parts.push(`【锚点句】“${sentence}”`);
  if (contextAfter) parts.push(`【光标后的后文】\n${contextAfter}`);
  parts.push('【本次维度】\n' + dimensions
    .map((d, i) => `${NUMERALS[i]}. ${d.type} · ${d.typeName}：${d.brief || d.typeName}`)
    .join('\n'));
  return parts.join('\n\n');
};

const server = http.createServer(async (req, res) => {
  // CORS headers just in case
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Static files
  if (pathname === '/' || pathname === '/index.html') {
    try {
      const filePath = path.join(__dirname, 'index.html');
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading index.html: ' + err.message);
    }
    return;
  }

  // API Proxy Endpoint
  if (pathname === '/api/chat' && req.method === 'POST') {
    let bodyStr = '';
    req.on('data', chunk => { bodyStr += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyStr || '{}');
        const { apiKey, apiBaseUrl, model } = payload;
        const sentence = clip(payload.sentence ?? payload.prompt, 400);
        const dimensions = normalizeDimensions(payload.dimensions);

        if (!apiKey || !apiKey.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'API Key 不能为空，请在设置中输入' }));
          return;
        }

        if (!sentence) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '请先写下一句话作为故事起点' }));
          return;
        }

        const userMessage = buildUserMessage({
          sentence,
          contextBefore: clip(payload.contextBefore, 1200),
          contextAfter: clip(payload.contextAfter, 400),
          title: clip(payload.title, 60),
          dimensions
        });

        let targetUrl = (apiBaseUrl || 'https://api.deepseek.com/v1').trim().replace(/\/+$/, '');
        if (!targetUrl.endsWith('/chat/completions')) {
          targetUrl += '/chat/completions';
        }

        console.log(`[API PROXY] 发送请求至: ${targetUrl}`);
        console.log(`[API PROXY] 模型: ${model || 'deepseek-chat'}, 锚点句: "${sentence}", 维度: ${dimensions.map(d => d.typeName).join(' / ')}`);

        const apiResponse = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`
          },
          body: JSON.stringify({
            model: (model || 'deepseek-chat').trim(),
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.9
          })
        });

        const status = apiResponse.status;
        console.log(`[API PROXY] 上游服务响应状态码: ${status}`);

        if (!apiResponse.ok) {
          const errText = await apiResponse.text();
          console.error(`[API PROXY 错误] HTTP ${status}:`, errText);
          let errorMsg = `上游接口返回错误 (${status})`;
          try {
            const errJson = JSON.parse(errText);
            if (errJson.error?.message) errorMsg = errJson.error.message;
            else if (errJson.message) errorMsg = errJson.message;
          } catch (_) {
            if (errText) errorMsg += `: ${errText.slice(0, 150)}`;
          }

          res.writeHead(status >= 400 && status < 600 ? status : 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: errorMsg, rawStatus: status }));
          return;
        }

        const data = await apiResponse.json();
        let rawContent = data.choices?.[0]?.message?.content || '{}';
        console.log(`[API PROXY 原始返回内容]:\n`, rawContent.slice(0, 200) + '...');

        // Clean markdown backticks ```json ... ```
        rawContent = rawContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) rawContent = jsonMatch[0];

        let parsed;
        try {
          parsed = JSON.parse(rawContent);
        } catch (parseErr) {
          console.error('[API PROXY] JSON 解析失败:', parseErr.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '模型输出格式解析失败: ' + parseErr.message, raw: rawContent }));
          return;
        }

        // 维度标签以请求为准，模型只负责标题与正文
        const modelBranches = Array.isArray(parsed.branches) ? parsed.branches : [];
        const branches = dimensions
          .map((d, idx) => ({
            type: d.type,
            typeName: d.typeName,
            tensionTitle: clip(modelBranches[idx]?.tensionTitle, 20) || d.typeName,
            sentence: clip(modelBranches[idx]?.sentence, 400),
            id: 'branch_' + Date.now() + '_' + idx
          }))
          .filter(b => b.sentence);

        if (branches.length === 0) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '模型没有返回可用的分支', raw: rawContent.slice(0, 300) }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, branches }));
      } catch (err) {
        console.error('[API PROXY 异常]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || '内部代理错误' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[SERVER] 可能性抽卡本地服务已启动: http://127.0.0.1:${PORT}`);
});
