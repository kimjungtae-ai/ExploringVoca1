// GET /api/word?w=report → 어원 탐험 JSON
// Gemini API 키는 Vercel 환경 변수 GEMINI_API_KEY 에만 있고, 브라우저(index.html)로는 절대 나가지 않음.
// 단어 하나만 받고 지시문은 서버에서 만들기 때문에, 이 주소를 아무 질문이나 하는 데 쓸 수는 없음.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const WORD = /^[a-z][a-z\-' ]{0,30}$/;
const PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR || 30);

const SYSTEM_INSTRUCTION = `
당신은 수능을 준비하는 한국 고등학생에게 친절하게 영어를 가르쳐 주는 베테랑 영어 교사이자 영어 어원 전문가입니다.
단어의 어원을 결코 억지로 지어내지 말고, 역사적 사실에 부합하는 경우에만 접두사/어근/접미사를 명쾌하게 분석하세요.
오늘날 영어에서 어원으로 쪼개기 어려운 단어는 "이 단어는 오늘날의 영어에서 이렇게 나누어 설명하기 어렵습니다"라고 정직하게 안내하세요.
고등학생이 쉽게 이해할 수 있는 따뜻한 존댓말(~해요체)로 응답하세요. meaning에는 수능에 자주 나오는 뜻을 자주 쓰이는 순서로 쓰세요.
파생어(family words)는 실제로 어원이 이어지는 자주 쓰이는 단어로 최대 6~8개, 각 단어마다 수능 지문 같은 B1~B2 수준 영어 예문(20단어 이하)과 한국어 번역을 포함하세요.

[매우 중요 - 이야기 작성 규칙]:
- 이야기(story)에는 탐험 단어 본체와 파생어를 포함하여 **최소 5개 이상의 영어 단어**가 반드시 포함되어야 합니다.
- 각 영어 단어는 반드시 '단어(한국어 뜻)' 형식으로 적으세요 (예: transport(수송하다), portable(휴대용의)).
- 고등학생도 웃을 반전과 유머를 담아 자연스러운 한국어 문장으로 작성하세요.
- 전체 분량은 공백 포함 250~300자 이내를 엄수하세요.

반드시 아래 JSON 스키마 규격에 맞춰 JSON 문자열만 출력하세요.
`;

const SCHEMA = {
    type: "OBJECT",
    properties: {
      word: { type: "STRING" },
      pos: { type: "STRING" },
      phonetic: { type: "STRING" },
      meaning: { type: "STRING" },
      isDifficultToSplit: { type: "BOOLEAN" },
      morphemes: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING" },
            part: { type: "STRING" },
            meaning: { type: "STRING" },
            note: { type: "STRING" }
          },
          required: ["type", "part", "meaning", "note"]
        }
      },
      summary: { type: "STRING" },
      historyTitle: { type: "STRING" },
      historyBody: { type: "STRING" },
      caution: { type: "BOOLEAN" },
      familyWords: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            word: { type: "STRING" },
            pos: { type: "STRING" },
            meaning: { type: "STRING" },
            en: { type: "STRING" },
            ko: { type: "STRING" }
          },
          required: ["word", "pos", "meaning", "en", "ko"]
        }
      },
      imageSense: { type: "STRING" },
      imageCaption: { type: "STRING" },
      movieLineEn: { type: "STRING" },
      movieLineKo: { type: "STRING" },
      storyTitle: { type: "STRING" },
      story: { type: "STRING" }
    },
    required: ["word", "pos", "meaning", "morphemes", "summary", "historyTitle", "historyBody", "familyWords", "imageSense", "imageCaption", "movieLineEn", "movieLineKo", "storyTitle", "story"]
  };

// 같은 서버 인스턴스 안에서만 세는 간단한 제한 (IP당 1시간에 PER_HOUR번)
const hits = new Map();
function limited(ip) {
  const now = Date.now(), hour = 3600e3;
  const list = (hits.get(ip) || []).filter(t => now - t < hour);
  if (list.length >= PER_HOUR) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

const send = (res, status, body) => { res.statusCode = status; res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(body)); };

async function callGemini(key, word, thinking) {
  const prompt = `영어 단어 "${word}"의 어원 탐험 데이터를 생성해 주세요. 반드시 이야기(story) 항목에 학습 단어(본 단어 및 파생어)가 최소 5개 이상 '단어(뜻)' 형식으로 자연스럽게 포함되도록 해주세요.`;
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        // 깊게 생각하지 않게 해서 응답을 빠르게
        ...(thinking ? { thinkingConfig: { thinkingLevel: "low" } } : {})
      }
    })
  });
}

module.exports = async (req, res) => {
  // GitHub Pages·미리보기에서도 부를 수 있게. 단어 하나만 받고 IP당 횟수를 제한하므로 열어 둬도 됨.
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return send(res, 405, { code: "bad_method" });
  const w = String((req.query && req.query.w) || "").trim().toLowerCase();
  if (!WORD.test(w)) return send(res, 400, { code: "bad_word" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return send(res, 503, { code: "server_not_ready" });
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  if (limited(ip)) return send(res, 429, { code: "rate_limited" });

  for (let attempt = 0; attempt < 2; attempt++) {
    let r = await callGemini(key, w, true);
    if (r.status === 400) {
      const t = await r.text();
      // 생각 수준 설정을 모르는 모델이면 설정 없이 다시
      if (/thinking/i.test(t)) r = await callGemini(key, w, false);
      else { console.error("gemini 400", t.slice(0, 300)); return send(res, 502, { code: "api_error" }); }
    }
    if (r.status === 429) return send(res, 429, { code: "rate_limited" });
    if (!r.ok) { console.error("gemini", r.status, (await r.text()).slice(0, 300)); return send(res, 502, { code: "api_error" }); }
    const json = await r.json();
    const parts = (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || [];
    const text = parts.filter(p => !p.thought && typeof p.text === "string").map(p => p.text).join("");
    try {
      const data = JSON.parse(text);
      if (!data || !data.word || !Array.isArray(data.morphemes)) throw new Error("shape");
      // 같은 단어는 Vercel CDN이 30일 동안 저장해 두었다가 바로 돌려줌 → 무료 한도 절약, 속도 향상
      res.setHeader("Cache-Control", "public, s-maxage=2592000, stale-while-revalidate=86400");
      return send(res, 200, data);
    } catch (e) { /* 형식이 깨진 답이면 한 번 더 */ }
  }
  return send(res, 502, { code: "invalid_json" });
};
