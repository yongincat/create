# 고양이 입양 홍보문 생성기

GitHub Pages에 배포되는 React + Vite 프런트엔드와, OpenAI를 안전하게 호출하는 Cloudflare Worker 백엔드로 구성된 프로젝트입니다. OpenAI API 키는 프런트엔드, 저장소, GitHub Pages 아티팩트 어디에도 포함되지 않습니다.

## 아키텍처
- 프런트엔드: Vite로 빌드한 React 앱, GitHub Pages에 배포.
- 백엔드: Cloudflare Worker가 토큰 검증, 레이트 리밋, CORS, OpenAI 호출을 처리.

왜 분리해야 하나요? GitHub Pages는 정적 파일만 제공하므로, 프런트엔드에 키를 넣는 순간 공개됩니다. 따라서 OpenAI 호출은 반드시 서버(Worker)에서 처리해야 합니다.

## 레포 구조
- `package.json`
- `vite.config.ts`
- `src/`
- `public/config.public.json`
- `worker/src/index.ts`
- `worker/wrangler.toml`
- `.github/workflows/deploy-pages.yml`
- `.github/workflows/deploy-worker.yml`

## 설정 방법

### 1) Cloudflare Worker 설정
1. Cloudflare에서 새 Worker를 생성하거나 Wrangler로 배포합니다.
2. 아래 시크릿을 Worker 환경 변수로 설정합니다.
   - `OPENAI_API_KEY`
   - `ALLOWED_TOKENS` (쉼표로 구분된 토큰 목록)
   - `ALLOWED_ORIGIN` (GitHub Pages 사이트 오리진, 예: `https://yourname.github.io`)
   - `MAX_OUTPUT_CHARS` (선택, 기본 `2500`, `public/config.public.json`과 동일하게 권장)

### 2) 공개 설정 파일
`public/config.public.json`에 Worker URL을 입력합니다.
```json
{
  "backendBaseUrl": "https://YOUR-WORKER.your-subdomain.workers.dev",
  "appTitle": "Cat Adoption Post Generator",
  "maxOutputChars": 2500
}
```

### 3) GitHub Pages 배포
GitHub Actions 워크플로우가 빌드 후 `dist/`를 GitHub Pages로 배포합니다.

### 4) GitHub Actions 시크릿 등록
GitHub 저장소 설정에서 다음 시크릿을 등록합니다.
`Settings -> Secrets and variables -> Actions`
- `OPENAI_API_KEY`
- `ALLOWED_TOKENS`
- `ALLOWED_ORIGIN`
- `CLOUDFLARE_API_TOKEN`
- `MAX_OUTPUT_CHARS` (선택)

## 사용 방법

쿼리 스트링 토큰으로 접근을 제한합니다.
```
https://<pages-url>/?token=YOURTOKEN
```

백엔드 직접 호출 예시:
```bash
curl -X POST https://YOUR-WORKER.your-subdomain.workers.dev/generate \
  -H "Content-Type: application/json" \
  -H "Origin: https://yourname.github.io" \
  -d '{
    "token": "YOURTOKEN",
    "inputs": {
      "catName": "Mochi",
      "ageValue": "8",
      "ageUnit": "months",
      "sex": "female",
      "neutered": "yes",
      "temperament": ["gentle", "curious"],
      "rescueStory": "Found near a neighborhood park.",
      "healthNotes": "Vaccinated and microchipped.",
      "specialNeeds": "",
      "adoptionRequirements": "Indoor-only home.",
      "contact": "adoptions@example.org"
    },
    "stylePreset": "Warm & Friendly",
    "creativity": 45
  }'
```

## 로컬 개발
- 프런트엔드: `npm install` 후 `npm run dev`
- 선택 사항: 개발용 오버라이드로 `public/config.local.json` 작성 (커밋하지 않음)
- Worker: `cd worker && npm install && npm run dev`

## 보안 주의사항
- OpenAI API 키는 프런트엔드 코드, JSON, GitHub Pages 아티팩트에 절대 포함되지 않습니다.
- `public/config.public.json` 또는 `public/config.local.json`에 API 키를 추가하지 마세요.
- 클라이언트 측 난독화는 보안이 아닙니다. 시크릿은 반드시 서버 측에만 두세요.
