# FocusTube

FocusTube is a production-style Chrome Extension (Manifest V3) + optional FastAPI backend that helps students stay focused on YouTube by prioritizing videos relevant to a selected study topic.

## Monorepo Structure

```text
.
├── backend
│   ├── .env.example
│   ├── requirements-dev.txt
│   ├── requirements.txt
│   ├── app
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── nlp.py
│   │   └── parsers.py
│   ├── samples
│   │   ├── sample_score_payload.json
│   │   └── sample_syllabus.txt
│   └── tests
│       ├── test_api.py
│       └── test_scoring.py
└── extension
    ├── manifest.json
    ├── package.json
    ├── tsconfig.json
    ├── public
    │   └── icons
    │       └── icon.svg
    ├── src
    │   ├── background
    │   │   └── background.ts
    │   ├── content
    │   │   ├── content.css
    │   │   └── content.ts
    │   ├── options
    │   │   ├── options.css
    │   │   ├── options.html
    │   │   └── options.ts
    │   ├── popup
    │   │   ├── popup.css
    │   │   ├── popup.html
    │   │   └── popup.ts
    │   └── shared
    │       ├── api.ts
    │       ├── constants.ts
    │       ├── scoring.ts
    │       ├── storage.ts
    │       ├── text.ts
    │       └── types.ts
    └── tests
        └── mock-data
            ├── topic.json
            └── videos.json
```

## Features Implemented

- Topic input from popup: `subject`, `subtopic`, optional `goal`
- Optional syllabus upload (`.pdf`, `.docx`, `.txt`) to backend
- Parsed syllabus stored in `chrome.storage.local`
- Hybrid relevance scoring:
  - keyword matching
  - phrase similarity
  - weighted score
- Strictness modes:
  - `strict`: hides unrelated cards
  - `balanced`: blurs/collapses unrelated cards
  - `explore`: keeps unrelated cards lower-priority with warning
- YouTube integration for home, search results, and watch sidebar via content script + MutationObserver
- SPA/infinite-scroll resilience with debounced rescoring
- Floating `FocusTube ON` badge
- “Why kept” reason (`matched keyword: ...`) + “Relevant” badge on cards
- Toolbar toggle + popup toggles (`pause`, `show hidden for 60s`)
- Allowlist/blocklist channel support
- Settings page with topic, strictness, syllabus summary, allow/block list, local-only mode
- Local stats tracking (`hidden count`, `relevant shown`, `last topic`)
- Import/export settings JSON
- Optional Pomodoro timer + session goal in popup

## Privacy Notice

- No account system
- No analytics/tracking
- Default behavior is local-only relevance scoring
- Backend is only used if `local-only mode` is disabled and for syllabus parsing/classification
- All settings live in `chrome.storage.local`

## Extension Setup (Local)

1. Open terminal in `extension/`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build:
   ```bash
   npm run build
   ```
4. Open Chrome and go to `chrome://extensions`.
5. Enable **Developer mode**.
6. Click **Load unpacked** and select the `extension/dist` folder.
7. Open YouTube (`https://www.youtube.com`) and use the extension popup.

## Backend Setup (Optional)

1. Open terminal in `backend/`.
2. (Optional) create venv and activate.
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the API:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
5. Health check:
   ```bash
   curl http://127.0.0.1:8000/health
   ```

## API Endpoints

### `GET /health`
Returns:
```json
{"status": "ok"}
```

### `POST /parse-syllabus`
- Multipart form with `file` (`PDF`, `DOCX`, `TXT`)

Returns:
```json
{
  "course_title": "...",
  "units": ["..."],
  "keywords": ["..."],
  "summary": "...",
  "focus_topics": ["..."]
}
```

### `POST /score-video`
Input:
```json
{
  "topic": "Physics",
  "subtopic": "Newton's Laws",
  "goal": "problem solving",
  "syllabus_keywords": ["force", "inertia"],
  "video_title": "...",
  "video_channel": "...",
  "video_description": "..."
}
```

Output:
```json
{
  "score": 0.78,
  "label": "relevant",
  "reasons": ["matched keyword: force"]
}
```

## Backend Tests

Run from `backend/`:

```bash
pip install -r requirements-dev.txt
pytest -q
```

## Sample Test Cases for Relevance Scoring

1. Relevant study case
- Topic: Physics / Newton's Laws
- Video: "Newton's Second Law Explained with Force and Acceleration Problems"
- Expected: `relevant` or `borderline`, score >= 0.4

2. Irrelevant case
- Topic: Physics / Newton's Laws
- Video: "Top 10 Football Skills 2026"
- Expected: `irrelevant`, score < 0.4

3. Borderline case
- Topic: Physics / Newton's Laws
- Video: "Momentum and Collisions Quick Revision"
- Expected: often `borderline` (depends on keyword overlap)

## Notes on Safety/Compliance

- Extension only filters client-side visibility of cards the user sees.
- No ad bypassing, no playback interception, no YouTube restrictions bypass.
- No aggressive scraping; metadata extraction is limited to visible card fields.

