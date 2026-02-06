# 고양이 입양 홍보문 생성기 (Netlify 통합)

GitHub에 있는 기존 레포를 Netlify에 연결해 배포하고, 백엔드는 Netlify Functions로 처리하는 구성입니다. OpenAI API 키는 절대 프런트엔드/정적 아티팩트에 포함되지 않습니다.

## 아키텍처
- 프런트엔드: Vite로 빌드한 React 앱, Netlify가 빌드/배포
- 백엔드: Netlify Functions가 토큰 검증, 레이트 리밋, CORS, OpenAI 호출

중요: 정적 호스팅에 키를 넣으면 공개됩니다. OpenAI 호출은 반드시 Functions에서 처리합니다.

## 레포 구조
- `package.json`
- `vite.config.ts`
- `src/`
- `public/config.public.json`
- `netlify/functions/generate.ts`
- `netlify.toml`

## 설정 방법

### 1) Netlify에 레포 연결
1. Netlify 대시보드에서 **New site from Git** 선택
2. GitHub 레포 선택
3. Build command: `npm run build`
4. Publish directory: `dist`

### 2) Netlify 환경 변수(시크릿) 등록
Netlify 대시보드에서 `Site settings -> Environment variables`에 아래 값을 추가합니다.
- `OPENAI_API_KEY`
- `ALLOWED_TOKENS` (쉼표로 구분된 토큰 목록)
- `ALLOWED_ORIGIN` (Netlify 사이트 오리진, 예: `https://your-site.netlify.app`)
- `MAX_OUTPUT_CHARS` (선택, 기본 `2500`)
- `PROMPT_ID` (선택, 프롬프트 식별자)

### 3) 공개 설정 파일
`public/config.public.json`은 **비밀값 없이** 아래처럼 사용합니다.
```json
{
  "backendBaseUrl": "/.netlify/functions",
  "appTitle": "Cat Adoption Post Generator",
  "maxOutputChars": 2500
}
```

## 사용 방법

쿼리 스트링 토큰으로 접근을 제한합니다.
```
https://<netlify-site>/?token=YOURTOKEN
```

백엔드 직접 호출 예시:
```bash
curl -X POST https://<netlify-site>/.netlify/functions/generate \
  -H "Content-Type: application/json" \
  -H "Origin: https://<netlify-site>" \
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
- Functions 로컬 테스트는 Netlify CLI로 진행 가능

## 보안 주의사항
- OpenAI API 키는 프런트엔드 코드, JSON, 정적 아티팩트에 절대 포함되지 않습니다.
- `public/config.public.json` 또는 `public/config.local.json`에 API 키를 추가하지 마세요.
- 클라이언트 측 난독화는 보안이 아닙니다. 시크릿은 반드시 서버 측에만 두세요.
