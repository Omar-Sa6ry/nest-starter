# Media Frontend Test Application

A dedicated React 18, TypeScript, and Vite testing application built to exercise, visualize, and validate the backend media subsystem, presigned upload pipelines, BullMQ background job queues, and WebSocket events.

---

## Overview

The Media Frontend acts as an interactive developer workbench and diagnostic laboratory for the media service. It implements end-to-end interactions against the real NestJS backend without needing hardcoded cloud credentials or administrative keys:

- **Authentication & User Profile**: Register and log in using GraphQL mutations to retrieve JWT access tokens, update user profiles, and link uploaded avatars.
- **S3 & MinIO Presigned Upload Pipeline**: Request presigned upload sessions directly from the GraphQL API, perform direct multipart browser uploads to S3/MinIO via `XMLHttpRequest`, and complete upload sessions.
- **Resumable Uploads & Offline Fault Tolerance**: Track uploaded parts using browser `IndexedDB`. If the browser tab is closed or a network drop occurs, upload sessions resume from the last successful part.
- **Realtime WebSocket Event Stream**: Connect to backend Socket.IO / WebSocket gateways to receive live processing progress, virus scan events, transcoding notifications, and deletion broadcasts.
- **Resumable Range Downloads**: Test HTTP `206 Partial Content` downloads with resume capabilities against presigned download URLs.
- **Automated Testing Dashboard**: Run and stream end-to-end media service test suites in real-time.

---

## Technical Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | React 18 | Declarative component UI and state management |
| **Language** | TypeScript 5 | Strict mode compilation and type safety (`tsc -b`) |
| **Build Tool** | Vite 5 | Rapid HMR dev server and optimized production packaging |
| **API Client** | Apollo Client 3 | GraphQL operations, error handling, and authorization headers |
| **Realtime** | WebSocket / Socket.IO | Bi-directional event communication and progress streaming |
| **Storage Engine** | IndexedDB | Local persistence of upload session parts for resume recovery |
| **Upload Transport** | `XMLHttpRequest` | Direct-to-bucket upload chunks with native progress reporting |
| **Styling** | Vanilla CSS | Custom responsive dashboard theme with zero heavy CSS dependencies |

---

## Core Upload Lifecycle Flow

```text
1. Client -> GraphQL API: createUploadSession(fileName, mimeType, fileSize, purpose)
   Backend returns: { sessionId, uploadId, parts: [{ partNumber, uploadUrl }], mediaId }

2. Client -> S3 / MinIO: Direct PUT requests with file chunks to presigned URLs
   - Chunks tracked in IndexedDB ('MediaUploadDB' -> 'sessions')
   - Upload progress and transfer speeds emitted to React UI components

3. Client -> GraphQL API: completeUpload(sessionId, parts: [{ partNumber, etag }])
   Backend validates ETags, marks Media entity uploaded, and dispatches BullMQ background jobs

4. Backend Worker -> WebSocket Gateway: Broadcasts processing events
   - Events: SCAN_STARTED -> PROCESSING_PROGRESS (0-100%) -> READY / FAILED

5. Client -> GraphQL API: getMediaDownloadUrl(mediaId)
   Client downloads or streams file using HTTP Range headers (206 status)
```

---

## Directory Structure

```text
media-frontend/
├── index.html                     # Vite entry HTML
├── vite.config.ts                 # Dev server proxy configuration (/graphql & /ws)
├── tsconfig.json                  # TypeScript compiler settings
├── tsconfig.app.json              # Application-specific TS configuration
├── tsconfig.node.json             # Vite/Node configuration
├── package.json                   # Dependencies and scripts
├── FULL_FLOW.md                   # Detailed architecture flow specification
├── image.png                      # Architecture infographic diagram
├── public/                        # Static public assets
├── scripts/
│   ├── cors.json                  # S3/MinIO bucket CORS configuration
│   └── init-localstack.sh         # LocalStack initialization script
└── src/
    ├── main.tsx                   # React root entry
    ├── App.tsx                    # Main container layout
    ├── styles.css                 # Global stylesheets
    ├── vite-env.d.ts              # Vite client types
    ├── api/
    │   ├── client.ts              # Apollo Client initialization with JWT auth link
    │   ├── operations.ts          # GraphQL queries and mutations
    │   └── testingApi.ts          # HTTP testing API client
    ├── auth/
    │   └── AuthContext.tsx        # Authentication context, tokens, and active user state
    ├── components/
    │   ├── AuthFlow.tsx           # Login and Registration tab panels
    │   ├── AvatarPicker.tsx       # Profile image uploader with crop and preview
    │   ├── Dashboard.tsx          # Main application dashboard layout
    │   ├── FileUploadLab.tsx      # Multi-file drag-and-drop upload workspace
    │   ├── MediaLabPro.tsx        # Advanced upload controller with pause/resume controls
    │   ├── RealtimePanel.tsx      # WebSocket event logger and live monitor
    │   ├── StatusBadge.tsx        # Processing status badge indicator
    │   ├── TestingDashboard.tsx   # Test runner execution dashboard
    │   └── UploadProgress.tsx     # Progress bars, transfer rates, and ETA timers
    ├── hooks/
    │   └── useTestingWS.ts        # Hook for test-runner WebSocket messages
    └── upload/
        ├── advancedUploader.ts    # Multipart chunking and concurrent queue engine
        ├── indexedDB.ts           # IndexedDB persistence layer for session caching
        ├── presignedUpload.ts     # S3 presigned PUT handler using XMLHttpRequest
        ├── resumableDownload.ts   # Range-header HTTP download manager
        ├── types.ts               # Upload state types, session types, and enums
        ├── useFileUpload.ts       # Hook exposing file upload controls to components
        ├── useUploadAvatar.ts     # Avatar-specific upload and profile link hook
        └── websocket.ts           # Realtime media event listener singleton
```

---

## Getting Started

### 1. Prerequisites

Ensure the main NestJS starter backend and supporting services (PostgreSQL, Redis, MinIO) are running:

```bash
# In the repository root
make docker-dev-up
make dev
```

### 2. Install Dependencies

Navigate into `media-frontend/` and install packages:

```bash
cd media-frontend
npm install
```

### 3. Start Development Server

Launch the Vite development server with proxy configured:

```bash
npm run dev
```

Open your browser at `http://localhost:5173`. Requests to `/graphql` and `/socket.io` are automatically proxied to the backend at `http://localhost:3000`.

### 4. Build for Production

Compile and bundle the frontend application:

```bash
npm run build
```

To preview the built assets locally:

```bash
npm run preview
```

---

## Available Scripts

- `npm run dev`: Starts Vite dev server with hot reload at port 5173.
- `npm run build`: Type-checks via `tsc -b` and produces optimized bundles in `dist/`.
- `npm run preview`: Spins up a local server to inspect production builds.
- `npm run typecheck`: Validates TypeScript types across the frontend project without emitting files.

---

## License

This package is part of the `@bts-soft/nest-starter` project and is licensed under the Apache-2.0 License.
