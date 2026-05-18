# Software Requirements Specification for PRISM-AI
**Version 1.0**

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) documents the requirements for PRISM-AI (Primary School Intelligent Student Management and Predictive Analytics Ecosystem). It covers the complete end-to-end system, including the local Edge AI inference component, the cloud-based backend API, the database, and the frontend web dashboard.

### 1.2 Document Conventions
This document follows standard IEEE formatting. 
*   **Bold** text is used for emphasis and key system entities.
*   Requirements are listed with a unique identifier (e.g., REQ-1) to ensure traceability.

### 1.3 Intended Audience and Reading Suggestions
This document is intended for software engineers (backend, frontend, and AI/ML), school administrators, and project stakeholders. 
*   **Developers/Engineers:** Should read all sections, paying close attention to Section 3 (System Features) and Section 5 (Nonfunctional Requirements).
*   **School Administrators/Stakeholders:** Should focus on Section 1 (Introduction) and Section 2 (Overall Description) to understand the system's value proposition and user interaction.

### 1.4 Project Scope
PRISM-AI addresses critical inefficiencies in primary school administration, specifically the "Visibility Gap" (manual attendance taking which wastes 15-20 minutes daily) and the "Engagement Gap" (objective monitoring of student participation). The system utilizes edge-AI for real-time facial recognition and behavioral classification without storing raw images, strictly maintaining minor student privacy in alignment with Education 5.0 and SDG Goal 4.1 (Quality Primary Education).

### 1.5 References
*   PRISM-AI System Context Document
*   Ultralytics YOLOv8 Documentation
*   React.js / Node.js standard styling guides
*   Supabase `pgvector` Documentation

---

## 2. Overall Description

### 2.1 Product Perspective
PRISM-AI is a new, self-contained ecosystem consisting of an edge-computing device (e.g., a teacher's laptop acting as the camera/inference node) and a centralized cloud backend. The AI processing happens locally on the edge device to ensure speed and privacy, and only lightweight payloads (JSON) are transmitted to the cloud for storage and real-time frontend updates.

### 2.2 Product Features
*   **Real-Time Attendance Tracking:** Automatically identifies and marks students present as they enter the classroom.
*   **Behavioral & Engagement Classification:** Analyzes Regions of Interest (ROIs) to classify student states (e.g., "Attentive", "Distracted").
*   **Privacy-Preserving Data Handling:** Extracts 128-dimensional facial embeddings locally. No raw images or video streams are saved or transmitted.
*   **Real-time Dashboard:** A responsive web application for teachers to view live attendance grids and socio-emotional heatmaps.

### 2.3 User Classes and Characteristics
*   **Teachers:** Primary users of the edge device and web dashboard. Requires a simple, non-intrusive UI to view class status.
*   **School Administrators:** Secondary users who might view aggregate data and school-wide analytics on the dashboard.
*   **System Administrators:** Responsible for setting up the Acer Aspire 3 hardware, installing Python environments, and configuring the network.

### 2.4 Operating Environment
*   **Edge Hardware:** Windows OS (specifically targeting consumer-grade Acer Aspire 3). Models must run efficiently on the CPU unless a CUDA GPU is present.
*   **Edge Software:** Python 3.12, PyTorch (CPU-optimized), Ultralytics YOLOv8n (Nano).
*   **Backend:** Node.js, Express.js.
*   **Database:** Supabase (PostgreSQL with `pgvector` extension).
*   **Frontend Client:** React.js, accessed via modern web browsers (Chrome, Edge, Firefox).

### 2.5 Design and Implementation Constraints
*   **Privacy Constraint:** Absolutely no raw images can be transmitted over the network or saved to disk.
*   **Hardware Limitations:** Must maintain high framerates on low-end CPUs (YOLOv8 Nano models mandatory).
*   **Platform:** Windows OS compatibility is strictly required for the edge scripts.

### 2.6 Assumptions and Dependencies
*   Classrooms have an active internet connection to transmit JSON payloads to Supabase.
*   The classroom camera provides adequate lighting and resolution for YOLO to detect faces and extract embeddings.

---

## 3. System Features

### 3.1 Edge AI Detection and Classification
#### 3.1.1 Description and Priority
**Priority: High.** The core computer vision pipeline running locally on the Windows machine. It captures video, detects students, classifies behavior, and extracts facial embeddings.

#### 3.1.2 Stimulus/Response Sequences
1.  **Stimulus:** Teacher starts the Python script on the classroom laptop.
2.  **System Response:** Camera initializes and YOLO begins bounded box detection.
3.  **System Response:** Emits a JSON payload containing the embeddings, behavioral states, and timestamps.

#### 3.1.3 Functional Requirements
*   **REQ-1:** The system shall utilize YOLOv8n to detect bounding boxes of students in the camera feed.
*   **REQ-2:** The system shall extract 128-dimensional mathematical embeddings from detected ROIs.
*   **REQ-3:** The system shall classify the behavioral state (e.g., "Attentive") for each detected student.
*   **REQ-4:** The system shall default to `device='cpu'` execution unless a CUDA-compatible GPU is confirmed.

### 3.2 Real-time Data Transmission and Verification
#### 3.2.1 Description and Priority
**Priority: High.** The Express.js backend and Supabase database working together to verify identities and store state.

#### 3.2.2 Stimulus/Response Sequences
1.  **Stimulus:** Python edge script sends an HTTP POST request with the JSON payload.
2.  **System Response:** Express.js API receives the payload and queries Supabase `pgvector` to find matching student embeddings.
3.  **System Response:** Updates the student's attendance and engagement state in the database.

#### 3.2.3 Functional Requirements
*   **REQ-5:** The Express API shall expose a secure endpoint to receive `[ {embedding, state, timestamp} ]` payloads.
*   **REQ-6:** The system shall use cosine similarity or L2 distance via Supabase `pgvector` to match the 128-d vectors against enrolled students.

### 3.3 Teacher Web Dashboard
#### 3.3.1 Description and Priority
**Priority: High.** The React.js frontend providing real-time visibility to the teacher.

#### 3.3.2 Stimulus/Response Sequences
1.  **Stimulus:** Supabase database records an updated student state.
2.  **System Response:** Supabase real-time subscriptions push the event to the React client.
3.  **System Response:** The React UI updates the attendance grid and emotional heatmap without requiring a page refresh.

#### 3.3.3 Functional Requirements
*   **REQ-7:** The dashboard shall display a real-time attendance grid.
*   **REQ-8:** The dashboard shall display a live socio-emotional heatmap representing current classroom engagement.

---

## 4. External Interface Requirements

### 4.1 User Interfaces
*   **React Dashboard:** Shall be built using modern web standards (HTML5, JS, CSS) emphasizing a clean, proactive UX.
*   **Edge CLI:** The Python script will be run via Windows PowerShell or Command Prompt. It may include a lightweight local output stream for debugging (e.g., `cv2.imshow`), though this must be toggleable.

### 4.2 Hardware Interfaces
*   **Camera Integration:** The Python script must communicate with standard USB Webcams or integrated laptop cameras using OpenCV APIs compatible with Windows.

### 4.3 Software Interfaces
*   **Supabase PostgreSQL:** Interaction via Supabase Client Libraries for Node.js to manage relational data and `pgvector` queries.

### 4.4 Communications Interfaces
*   **HTTP/REST:** Communication between the Python Edge node and the Express.js API via standard POST requests.
*   **WebSockets:** Real-time data feed between Supabase and the React frontend.

---

## 5. Other Nonfunctional Requirements

### 5.1 Performance Requirements
*   The Edge AI script must process frames fast enough on a consumer CPU to accurately capture student movements and states (target: >= 10-15 FPS on Acer Aspire 3).
*   End-to-end latency from camera capture to React dashboard update should be under 2 seconds.

### 5.2 Privacy and Security Requirements
*   **Absolute Privacy Rules:** Raw pixel data or image frames must never be saved, cached, or transmitted over the internet to protect minor privacy.
*   Authentication is required for teachers and admins to access the React dashboard.
*   API endpoints must require a secure key or token from the edge device to prevent spoofed data inserts.

### 5.3 Software Quality Attributes
*   **Portability:** While initially targeted at Windows OS, the Python logic should remain as OS-agnostic as possible, save for hardware-specific optimizations.
*   **Robustness:** The edge script must automatically attempt to reconnect to the Express API if the network drops.

---

## Appendix A: Glossary
*   **ROI (Region of Interest):** the bounding box area in an image where a student is detected.
*   **128-d Embedding:** A mathematical vector representing unique facial features without retaining visual likeness.
*   **pgvector:** A PostgreSQL extension for storing and querying vector embeddings.
