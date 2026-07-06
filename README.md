---
title: RoadScan AI
emoji: 🛣️
colorFrom: blue
colorTo: orange
sdk: docker
pinned: false
---

<div align="center">
  <img src="https://raw.githubusercontent.com/m-pranavraj/RoadScan/0a20eb5fcf0dddd0f9b60cf93c662589fbfd2f3d/docs/assets/hero_banner.png" alt="RoadScan Hero Banner" width="100%" />
  
  **Real-Time AI-Powered Road Infrastructure & Litter Monitoring System**

  [![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react&logoColor=black)](#)
  [![Hono](https://img.shields.io/badge/Backend-Hono.js-E36002?logo=hono&logoColor=white)](#)
  [![ONNX Runtime](https://img.shields.io/badge/AI_Engine-ONNX_Runtime-005CED?logo=onnx&logoColor=white)](#)
  [![Supabase](https://img.shields.io/badge/Database-Supabase%20%2B%20PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](#)
</div>

<br />

RoadScan is a comprehensive, full-stack AI platform designed to analyze roads and public infrastructure. By combining real-time edge AI inferencing and a robust cloud backend, RoadScan empowers municipalities, communities, and individuals to instantly detect, track, and map road hazards (like potholes) and environmental issues (like plastic waste and litter).

---

## 📖 Table of Contents
- [Non-Technical Overview](#-non-technical-overview)
- [How It Works (User Journey)](#-how-it-works-user-journey)
- [Technical Architecture](#-technical-architecture)
- [Deep Dive: The AI Engine](#-deep-dive-the-ai-engine)
- [Data Flow Diagram](#-data-flow-diagram)
- [Tech Stack Details](#-tech-stack-details)
- [Getting Started](#-getting-started)

---

## 🌍 Non-Technical Overview

### The Problem
Poor road conditions and uncontrolled littering cause accidents, vehicle damage, and environmental degradation. Traditional methods of auditing infrastructure are manual, slow, and expensive. Potholes often go unreported until an accident occurs, and illegal dumping goes unnoticed.

### The Solution: RoadScan
RoadScan turns any smartphone, dashcam, or camera into an intelligent auditor. 
- **Automated Detection**: Simply point a camera (or upload a video/photo), and the AI instantly draws boxes around potholes and litter.
- **Severity Assessment**: The system calculates the severity of the damage based on the size and concentration of the detected objects.
- **Global Mapping**: Every detected issue is logged with GPS coordinates and plotted on an interactive, public map. City planners or volunteers can see exactly where repairs or cleanups are needed.
- **Open & Transparent**: Anyone can view the public map, click on a hazard, see who reported it, and view the visual proof of the issue.

---

## 🚀 How It Works (User Journey)

1. **Capture & Upload**: A user uploads a video file, an image, or uses the Live Camera feature directly from their smartphone browser.
2. **AI Analysis**: The image or video frame is securely transmitted to the RoadScan backend. The ONNX-powered AI model scans the image pixel-by-pixel, identifying `Potholes`, `Plastic Waste`, and `Other Litter`.
3. **Annotation**: The server draws high-visibility geometric boxes over the detected issues and generates a labeled image. 
4. **Geolocation**: If the user grants GPS permission (or if the photo has EXIF location data), the hazard's exact latitude and longitude are recorded.
5. **Mapping & Reporting**: The scan is saved to the database. It instantly appears on the global detection map, categorized by severity, making it easy for authorities to prioritize maintenance.

---

## 🏗 Technical Architecture

RoadScan is architected as a modern, decoupled monorepo, ensuring high performance, scalability, and strict end-to-end type safety.

```mermaid
graph TD
    %% Frontend Layer
    subgraph Frontend [Client - React / Vite]
        UI[UI Components & Dashboard]
        Cam[WebRTC Live Camera]
        Map[Leaflet Map Integration]
        API_Client[Zodios API Client]
        
        UI --> API_Client
        Cam --> API_Client
        Map --> API_Client
    end

    %% Backend Layer
    subgraph Backend [Server - Hono.js]
        Router[Hono API Router]
        Auth[JWT Authentication]
        ORMM[Drizzle ORM]
        
        subgraph AI_Engine [AI Detection Engine]
            FFMPEG[FFmpeg Frame Extractor]
            Sharp[Sharp Image Processor]
            ONNX[ONNX Runtime Web]
            YOLO[YOLOv8 Weights]
            
            FFMPEG --> Sharp
            Sharp --> ONNX
            ONNX --> YOLO
        end
        
        Router --> Auth
        Router --> AI_Engine
        Router --> ORMM
    end

    %% Database Layer
    subgraph Cloud [Database & Storage]
        PG[(Supabase PostgreSQL)]
        Storage[(Local File System / Volumes)]
    end

    %% Connections
    API_Client -- "REST / HTTP POST (Multipart)" --> Router
    ORMM -- "SQL" --> PG
    AI_Engine -- "Save Annotated Images" --> Storage
```

### Key Architectural Decisions:
1. **Monorepo Structure (pnpm workspaces)**: Sharing code between frontend and backend ensures types are perfectly synchronized. An OpenAPI spec is maintained as the single source of truth, from which frontend clients (`@workspace/api-client-react`) are automatically generated.
2. **Hono.js Backend**: Chosen for its ultra-fast performance and Edge compatibility.
3. **Server-Side AI Inference**: To ensure the frontend runs smoothly on low-end mobile devices, the heavy lifting of AI inference is offloaded to the Node.js backend using `onnxruntime-node`.

---

## 🧠 Deep Dive: The AI Engine

The core of RoadScan is the AI Detection Engine, which bridges standard Node.js server technology with deep learning computer vision.

1. **Media Normalization (FFmpeg & Sharp)**
   - If a video is uploaded, the server uses `child_process` and `ffmpeg` to instantly extract a representative high-quality JPEG frame.
   - `sharp` is then used to resize, normalize, and format the image to the exact tensor shape required by the YOLOv8 model (e.g., `640x640 RGB`).

2. **Tensor Processing (ONNX)**
   - The normalized pixel arrays are converted into `Float32Array` tensors.
   - `onnxruntime-node` loads a pre-trained YOLOv8 object detection model and executes an inference pass.
   - The output is a massive raw tensor containing bounding box coordinates and confidence scores for thousands of anchor points.

3. **Non-Maximum Suppression (NMS)**
   - The engine applies a mathematical NMS algorithm to filter out overlapping bounding boxes, keeping only the predictions with the highest confidence scores.

4. **Annotation Generation (Vector Graphics)**
   - Instead of relying on unreliable system fonts, RoadScan's engine dynamically generates raw SVG `<path>` elements to draw text and geometric bounding boxes.
   - `sharp` composites this SVG overlay back onto the original high-resolution image, producing a visual report where the hazards are perfectly highlighted, regardless of the underlying server's OS or font configurations.

---

## 🔄 Data Flow Diagram

The following sequence diagram illustrates the lifecycle of a real-time manual capture:

```mermaid
sequenceDiagram
    actor User
    participant App as React Frontend
    participant Server as Hono API Backend
    participant AI as ONNX Runtime
    participant DB as Supabase (PostgreSQL)

    User->>App: Clicks "Capture Frame"
    App->>App: Captures WebRTC Frame (Blob)
    App->>App: Fetches Geolocation (Lat/Lon)
    App->>Server: POST /api/analyze/frame (Multipart Form)
    
    Server->>AI: Pass image buffer
    AI->>AI: Resize to 640x640 (Sharp)
    AI->>AI: Run YOLOv8 Inference
    AI->>AI: Apply NMS (Filter Boxes)
    AI->>AI: Draw SVG annotations
    AI-->>Server: Return Annotated Image & Objects Array
    
    Server->>DB: INSERT INTO detections (with GPS, severity, counts)
    DB-->>Server: Return Detection ID
    Server-->>App: 200 OK (JSON with Object Data)
    
    App->>App: Render Bounding Boxes on screen
    App->>User: Display "Processing Complete" and update stats
```

---

## 🛠 Tech Stack Details

### **Frontend App (`artifacts/detect-app`)**
- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Framer Motion (for fluid micro-animations)
- **Data Fetching**: React Query (TanStack) + Zodios (Typesafe API client)
- **Mapping**: Leaflet + OpenStreetMap integration
- **Icons**: Lucide React

### **Backend API (`artifacts/api-server`)**
- **Server**: Hono.js
- **Runtime**: Node.js v22
- **Database ORM**: Drizzle ORM
- **Computer Vision**: ONNX Runtime Node (`onnxruntime-node`), Sharp (Image processing), FFmpeg (Video extraction)
- **Logging**: Pino

### **Infrastructure & Tooling**
- **Database**: Supabase (PostgreSQL)
- **Monorepo**: pnpm workspaces
- **API Spec**: OpenAPI (Swagger) with Orval code generation
- **Containerization**: Docker (Multi-stage builds)

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20
- pnpm >= 10
- PostgreSQL database (Supabase recommended)
- FFmpeg installed on your system (for video uploads)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/m-pranavraj/RoadScan.git
   cd RoadScan
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up Environment Variables**
   Create a `.env` file in the root based on `.env.example`:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/roadscan"
   JWT_SECRET="your-super-secret-key-change-in-production"
   PORT=9091
   ```

4. **Initialize the Database**
   Push the Drizzle schema to your PostgreSQL database:
   ```bash
   pnpm run db:push
   ```

5. **Start the Development Servers**
   Run both frontend and backend concurrently:
   ```bash
   pnpm run dev
   ```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:9091](http://localhost:9091)

---

*Built with precision and AI to keep our communities clean and safe.*
