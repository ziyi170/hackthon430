# WBTI (Web Browsing Type Indicator)

WBTI is a browser-based behavior profiling experiment.  
It observes a user's search and browsing interactions for about 5 minutes within a selected topic, then infers a behavioral persona and an MBTI-like tendency.

## What It Does

- Boots a disposable browser runtime with BrowserPod.
- Starts an internal WBTI test server inside that runtime.
- Exposes a sharable portal link for participants.
- Generates a homepage QR code for quick mobile access.
- Records interaction events (search, click, dwell, scroll, share, bookmark, etc.).
- Produces a final report with:
  - Primary/secondary persona
  - MBTI tendency hint
  - Multi-dimensional behavior metrics
  - Timeline and radar visualizations

## Tech Stack

- Frontend host console: Vite + vanilla JavaScript
- Runtime orchestration: `@leaningtech/browserpod`
- Test service: Node.js + Express (inside BrowserPod)
- QR generation: `qrcode`

## Project Structure

- `src/main.js`: host console logic (BrowserPod boot, portal link, QR generation, live stats polling)
- `src/style.css`: host console UI styles
- `public/project/main.js`: in-pod Express server and WBTI test page
- `public/project/package.json`: in-pod service dependencies
- `index.html`: host console entry page

## Prerequisites

- Node.js 18+ (recommended)
- A valid BrowserPod API key

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`:

```env
VITE_BP_APIKEY=your_browserpod_api_key
```

## Run Locally

Start development server:

```bash
npm run dev
```

Build production assets:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Basic Flow

1. Open the host console page.
2. BrowserPod boots and launches the in-pod WBTI service.
3. The console shows:
   - Portal URL
   - QR code to open the test quickly on another device
4. Participant runs the 5-minute test in a selected topic.
5. The system computes behavioral metrics and outputs a WBTI report.

## Notes

- Session data is in-memory in the in-pod server and mainly for demo/prototyping.
- `dist/` contains build outputs and should be treated as generated artifacts.
- `public/project/main.js` is currently a single-file service (UI + API) for rapid iteration.
