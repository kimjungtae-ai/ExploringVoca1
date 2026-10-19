# ExploringVoca1
Exploring English Vocabulary

영어 단어를 넣으면 어원(접두사·어근·접미사), 역사, 같은 뿌리 단어, 예문, 이야기를 보여 주는 페이지입니다.

## 파일 구성

| 파일 | 하는 일 |
|---|---|
| `index.html` | 화면 전부. **API 키를 넣지 않습니다.** |
| `api/word.js` | Vercel 서버 함수. `GET /api/word?w=단어` → Gemini로 만든 어원 JSON |

## 배포 (Vercel)

1. Vercel 프로젝트 → **Settings → Environment Variables**에 `GEMINI_API_KEY` = [Google AI Studio](https://aistudio.google.com/apikey)에서 만든 키를 넣습니다.
2. **Deployments → Redeploy**로 다시 배포합니다.

API 키는 Vercel 환경 변수에만 두고, `index.html`이나 저장소 어디에도 적지 않습니다. 저장소가 공개라서 파일에 적은 키는 누구나 볼 수 있습니다.

선택 환경 변수:

- `GEMINI_MODEL` (기본 `gemini-flash-latest`)
- `RATE_LIMIT_PER_HOUR` (기본 30): 한 사람(IP)이 한 시간에 새로 만들 수 있는 단어 수

같은 단어는 Vercel CDN이 30일 동안 저장해 두었다가 바로 돌려주므로, 무료 한도를 아끼고 더 빨리 뜹니다.
