# Software Requirements Specification

## for

# PRISM-AI

### (Primary School Intelligent Student Management and Predictive Analytics Ecosystem)

**Version 2.0**

**Prepared by:** Hazwan Harith  
**Organization:** Faculty of Computing, Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA)  
**Date Created:** 17 April 2026

---

## Revision History

| Name | Date | Reason For Changes | Version |
|---|---|---|---|
| Hazwan Harith | 13 April 2026 | Initial draft created from project blueprint | 1.0 |
| Hazwan Harith | 17 April 2026 | Complete rewrite — expanded all sections to full IEEE 830 compliance, added Use-Case detail, Analysis Models, Safety/Security split, Issues List | 2.0 |

---

## Table of Contents

1. [Introduction](#1-introduction)
   - 1.1 [Purpose](#11-purpose)
   - 1.2 [Document Conventions](#12-document-conventions)
   - 1.3 [Intended Audience and Reading Suggestions](#13-intended-audience-and-reading-suggestions)
   - 1.4 [Project Scope](#14-project-scope)
   - 1.5 [References](#15-references)
2. [Overall Description](#2-overall-description)
   - 2.1 [Product Perspective](#21-product-perspective)
   - 2.2 [Product Features](#22-product-features)
   - 2.3 [User Classes and Characteristics](#23-user-classes-and-characteristics)
   - 2.4 [Operating Environment](#24-operating-environment)
   - 2.5 [Design and Implementation Constraints](#25-design-and-implementation-constraints)
   - 2.6 [User Documentation](#26-user-documentation)
   - 2.7 [Assumptions and Dependencies](#27-assumptions-and-dependencies)
3. [System Features](#3-system-features)
   - 3.1 [Edge AI Detection and Tracking](#31-edge-ai-detection-and-tracking)
   - 3.2 [Behavioral and Engagement Classification](#32-behavioral-and-engagement-classification)
   - 3.3 [128-d Facial Embedding Extraction](#33-128-d-facial-embedding-extraction)
   - 3.4 [Real-Time Data Transmission (Edge → Backend)](#34-real-time-data-transmission-edge--backend)
   - 3.5 [Identity Verification and Attendance Marking](#35-identity-verification-and-attendance-marking)
   - 3.6 [Teacher Web Dashboard — Attendance View](#36-teacher-web-dashboard--attendance-view)
   - 3.7 [Teacher Web Dashboard — Engagement Heatmap](#37-teacher-web-dashboard--engagement-heatmap)
   - 3.8 [User Authentication and Role Management](#38-user-authentication-and-role-management)
4. [External Interface Requirements](#4-external-interface-requirements)
   - 4.1 [User Interfaces](#41-user-interfaces)
   - 4.2 [Hardware Interfaces](#42-hardware-interfaces)
   - 4.3 [Software Interfaces](#43-software-interfaces)
   - 4.4 [Communications Interfaces](#44-communications-interfaces)
5. [Other Nonfunctional Requirements](#5-other-nonfunctional-requirements)
   - 5.1 [Performance Requirements](#51-performance-requirements)
   - 5.2 [Safety Requirements](#52-safety-requirements)
   - 5.3 [Security Requirements](#53-security-requirements)
   - 5.4 [Privacy Requirements](#54-privacy-requirements)
   - 5.5 [Software Quality Attributes](#55-software-quality-attributes)
6. [Other Requirements](#6-other-requirements)
- [Appendix A: Glossary](#appendix-a-glossary)
- [Appendix B: Analysis Models](#appendix-b-analysis-models)
- [Appendix C: Issues List](#appendix-c-issues-list)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) documents the complete functional and nonfunctional requirements for **PRISM-AI v1.0** — the *Primary School Intelligent Student Management and Predictive Analytics Ecosystem*. The scope of this document covers the full end-to-end system:

1. **Edge AI Service** (Python) — local computer-vision inference on a classroom laptop.
2. **Backend API** (Express.js / Node.js) — the centralized API gateway and business-logic layer.
3. **Database** (Supabase / PostgreSQL with `pgvector`) — relational storage, vector similarity search, and real-time event broadcasting.
4. **Frontend Client** (React.js) — the web-based dashboard consumed by teachers and administrators.

This document is intended to serve as the **single authoritative reference** for all development, testing, and acceptance activities throughout the Rapid Application Development (RAD) lifecycle.

### 1.2 Document Conventions

This document follows the **IEEE Std 830-1998** (IEEE Recommended Practice for Software Requirements Specifications) structure with the following conventions:

* **Bold** text denotes system entities, component names, or critical constraints.
* *Italic* text denotes defined terms (see Appendix A: Glossary).
* Each functional requirement is tagged with a unique identifier in the format `REQ-<number>` to ensure full traceability from requirements → design → test cases.
* Priority inheritance: Unless explicitly overridden, a detailed requirement inherits the priority level of its parent System Feature.
* Requirement priority levels used: **High** (must-have for v1.0), **Medium** (should-have), **Low** (nice-to-have / deferred to v2.0).

### 1.3 Intended Audience and Reading Suggestions

This document serves the following audiences:

| Audience | Recommended Sections | Rationale |
|---|---|---|
| **AI/ML Engineers** | §1, §2.4–2.5, §3.1–3.3, §5.1 | YOLO pipeline constraints, CPU optimization targets, embedding specifications. |
| **Backend Developers** | §3.4–3.5, §4.3–4.4, §5.3 | API design, pgvector queries, authentication, and data-transmission protocols. |
| **Frontend Developers** | §3.6–3.8, §4.1, §5.1 | Dashboard components, real-time subscriptions, UX expectations. |
| **Project Supervisor / Examiner** | §1–2, §5, Appendix B | High-level scope, architecture diagrams, and quality attributes. |
| **School Administrators** | §1.4, §2.1–2.3, §5.2–5.4 | Value proposition, user roles, and child-safety/privacy guarantees. |
| **QA / Testers** | §3 (all), §5 | Every REQ identifier maps to a testable acceptance criterion. |

**Suggested reading order:** Begin with §1 and §2 for context, then proceed to §3 for detailed features, and finally §5 for quality-gate criteria.

### 1.4 Project Scope

PRISM-AI addresses two critical inefficiencies identified in Malaysian primary-school administration:

1. **The "Visibility Gap"** — Manual attendance taking across multiple class periods wastes an estimated **15–20 minutes daily** per teacher and remains prone to human error and proxy attendance.
2. **The "Engagement Gap"** — A single teacher physically cannot objectively monitor the participation and emotional state of **20+ students** simultaneously, leading to disengaged students going unnoticed.

**PRISM-AI's solution** is an edge-AI ecosystem that:

* Automates attendance via real-time facial recognition running on a teacher's existing laptop.
* Provides objective, live engagement analytics (socio-emotional heatmaps) on a web dashboard.
* Strictly preserves minor data privacy by processing video locally and **never saving or transmitting raw images** — only 128-dimensional mathematical vectors and behavioral labels leave the edge device.

**Alignment:**
* **Education 5.0** — Leveraging AI/IoT to enhance the classroom experience without replacing the teacher.
* **UN SDG Goal 4.1** — Ensure inclusive and equitable quality primary education.

**Out of scope for v1.0:** Parent-facing mobile app, predictive grade analytics, multi-camera orchestration, cloud-based model training.

### 1.5 References

| # | Reference | Description |
|---|---|---|
| R1 | PRISM-AI System Context & Project Blueprint Document | Internal architecture specification provided to the development team. |
| R2 | IEEE Std 830-1998 | IEEE Recommended Practice for Software Requirements Specifications. |
| R3 | Ultralytics YOLOv8 Documentation (https://docs.ultralytics.com) | Official documentation for the YOLO model family used in this project. |
| R4 | Supabase Documentation (https://supabase.com/docs) | Platform documentation for PostgreSQL hosting, Auth, Realtime, and `pgvector`. |
| R5 | `pgvector` Extension (https://github.com/pgvector/pgvector) | PostgreSQL extension for storing and querying vector embeddings. |
| R6 | React.js Documentation (https://react.dev) | Official React documentation for frontend component architecture. |
| R7 | Express.js Documentation (https://expressjs.com) | Official Express.js API reference for the backend server. |
| R8 | OpenCV Python Documentation (https://docs.opencv.org) | Computer vision library used for camera capture and image preprocessing. |
| R9 | PyTorch Documentation (https://pytorch.org/docs) | Deep learning framework — CPU-optimized build used for inference. |

---

## 2. Overall Description

### 2.1 Product Perspective

PRISM-AI is a **new, self-contained ecosystem** — it is not a replacement for or extension of any existing school management software. The system is composed of two physically separated tiers that communicate over standard HTTP:

1. **Edge Tier (Classroom Laptop):** A Python 3.12 service that controls the local webcam, runs all AI inference (YOLO detection, behavioral classification, embedding extraction) on the device CPU, and pushes lightweight JSON payloads to the cloud.

2. **Cloud Tier (Web Services):** An Express.js API gateway, a Supabase PostgreSQL database (with `pgvector` for vector similarity), and a React.js single-page application (SPA) served to teacher/admin browsers.

**Context Diagram:**

```
┌─────────────────────────────────────────────────────────┐
│                    CLASSROOM (Edge)                      │
│  ┌──────────┐    ┌───────────────────────────────────┐  │
│  │  Webcam   │───▶│  Python Edge Service (YOLO + CV)  │  │
│  └──────────┘    │  • Detection & Tracking            │  │
│                  │  • Behavioral Classification       │  │
│                  │  • 128-d Embedding Extraction       │  │
│                  └──────────────┬────────────────────┘  │
│                                 │ JSON POST              │
└─────────────────────────────────┼───────────────────────┘
                                  │ HTTPS
┌─────────────────────────────────┼───────────────────────┐
│                    CLOUD TIER   ▼                        │
│  ┌───────────────────────────────────┐                  │
│  │      Express.js API Gateway       │                  │
│  │  • Validate payload               │                  │
│  │  • Authenticate edge device       │                  │
│  └──────────────┬────────────────────┘                  │
│                 │                                        │
│  ┌──────────────▼────────────────────┐                  │
│  │   Supabase (PostgreSQL + pgvector)│                  │
│  │  • Store 128-d embeddings         │                  │
│  │  • Vector similarity matching     │                  │
│  │  • Attendance & engagement records│                  │
│  │  • Real-time event broadcasting   │                  │
│  └──────────────┬────────────────────┘                  │
│                 │ WebSocket (Realtime)                   │
│  ┌──────────────▼────────────────────┐                  │
│  │       React.js Dashboard (SPA)    │                  │
│  │  • Live attendance grid           │                  │
│  │  • Socio-emotional heatmap        │                  │
│  │  • Admin analytics panel          │                  │
│  └───────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Product Features

The following is a high-level summary of the major product features. Detailed requirements are specified in §3.

| # | Feature | Description |
|---|---|---|
| F1 | Real-Time Attendance Tracking | Automatically identifies enrolled students via facial embeddings and marks them present/absent in real time. |
| F2 | Behavioral & Engagement Classification | Classifies each detected student's engagement state (e.g., "Attentive", "Distracted", "Drowsy") using YOLO-based classification of ROIs. |
| F3 | Privacy-Preserving Design | All AI inference occurs locally. Only 128-d vectors and textual labels are transmitted — **no raw images are ever saved or sent**. |
| F4 | Live Teacher Dashboard | A responsive React.js web app showing real-time attendance grids and a live socio-emotional engagement heatmap per classroom. |
| F5 | Secure Identity Verification | Uses cosine similarity / L2 distance on `pgvector` to match incoming embeddings against enrolled student profiles. |
| F6 | Role-Based Access Control | Authentication via Supabase Auth with distinct roles for Teachers, Administrators, and System Admins. |

### 2.3 User Classes and Characteristics

| User Class | Frequency of Use | Technical Expertise | Primary Functions | Priority |
|---|---|---|---|---|
| **Teacher** | Daily, during every class period | Low — expects simple, non-intrusive UI | Start/stop edge script; view attendance grid; view engagement heatmap; mark manual overrides. | **Primary** (favored user) |
| **School Administrator** | Weekly/Monthly | Low–Medium | View aggregate attendance reports; view school-wide analytics; manage class/student rosters. | **Secondary** |
| **System Administrator** | During setup and maintenance | High | Install Python environment; configure hardware/webcam; manage API keys and Supabase settings; troubleshoot network issues. | **Tertiary** |

### 2.4 Operating Environment

#### 2.4.1 Edge Device Environment

| Component | Specification |
|---|---|
| **Target Hardware** | Acer Aspire 3 (consumer-grade laptop) or equivalent |
| **Operating System** | Windows 10/11 (64-bit) |
| **Runtime** | Python 3.12 |
| **AI Framework** | PyTorch (CPU-optimized build); Ultralytics YOLOv8 |
| **Model Size** | YOLOv8n (Nano) — mandatory for CPU performance |
| **Compute Device** | `device='cpu'` by default; CUDA GPU supported if explicitly available |
| **Camera** | Standard USB webcam or integrated laptop camera (via OpenCV) |

#### 2.4.2 Backend & Frontend Environment

| Component | Specification |
|---|---|
| **Backend Runtime** | Node.js (LTS), Express.js |
| **Database** | Supabase (hosted PostgreSQL 15+ with `pgvector` extension enabled) |
| **Frontend Framework** | React.js (with Vite as build tool) |
| **Supported Browsers** | Google Chrome, Microsoft Edge, Mozilla Firefox (latest 2 major versions) |

### 2.5 Design and Implementation Constraints

| ID | Constraint | Rationale |
|---|---|---|
| C1 | **No raw image storage or transmission.** Pixel data must never leave the edge device's RAM. | Minor student privacy protection; Education 5.0 compliance. |
| C2 | **Edge inference must default to `device='cpu'`** unless a CUDA-compatible NVIDIA GPU is confirmed at runtime. | Target hardware (Acer Aspire 3) lacks a discrete GPU. |
| C3 | **YOLOv8 Nano (n) models are mandatory** for the detection and classification pipelines. | Larger model variants will not achieve acceptable framerates on consumer CPUs. |
| C4 | **Windows OS compatibility is required** for all edge-tier Python scripts. | The deployment environment is exclusively Windows. |
| C5 | Backend must use **Supabase** as the sole database and auth provider. | Project constraint — leveraging Supabase's real-time and `pgvector` capabilities. |
| C6 | Frontend must be a **React.js Single Page Application (SPA)**. | Team expertise and project requirements. |
| C7 | All API communication between edge and backend must use **HTTPS/REST**. | Security over public networks. |

### 2.6 User Documentation

The following documentation deliverables shall accompany the software:

| Document | Format | Description |
|---|---|---|
| **Edge Setup Guide** | PDF / Markdown | Step-by-step instructions for installing Python 3.12, creating a virtual environment, installing dependencies (`requirements.txt`), configuring the webcam, and running the inference script on a Windows machine. |
| **Teacher's Quick-Start Guide** | PDF (single page) | A one-page visual guide showing how to start the edge script, log in to the dashboard, and interpret the attendance grid and heatmap. |
| **System Administrator Manual** | PDF / Markdown | Covers Supabase project setup, `pgvector` configuration, Express.js deployment, environment variable configuration, and API key management. |
| **In-App Help Tooltips** | React components | Contextual tooltips within the React dashboard explaining UI elements (e.g., heatmap color legend, attendance status icons). |

### 2.7 Assumptions and Dependencies

| ID | Assumption / Dependency | Type | Risk if Invalid |
|---|---|---|---|
| A1 | Classrooms have a **stable internet connection** (minimum 1 Mbps upload) to transmit JSON payloads to the Supabase backend. | Assumption | Edge data will queue locally and may cause stale dashboard data. |
| A2 | The classroom webcam provides **adequate lighting and resolution** (minimum 720p) for YOLO to detect faces at typical classroom distances (1–5 meters). | Assumption | Detection accuracy will degrade; false negatives increase. |
| A3 | **Supabase** free/pro tier provides sufficient database storage, `pgvector` support, and real-time connection slots for the prototype phase. | Dependency | May need to migrate to self-hosted PostgreSQL. |
| A4 | The **Ultralytics YOLOv8** library and pre-trained Nano weights remain freely available under their current AGPL-3.0 license for academic use. | Dependency | Would require sourcing an alternative detection model. |
| A5 | Student **enrollment** (name, class, and initial face embedding) is performed as a one-time setup before the system goes live in a classroom. | Assumption | Without enrollment data, identity verification cannot function. |
| A6 | A maximum of **40 students** are present in any single classroom at one time. | Assumption | Exceeding this may impact CPU inference speed and tracking accuracy. |
| A7 | Teachers have access to a **modern web browser** (Chrome, Edge, or Firefox) on a device separate from or the same as the edge laptop. | Assumption | Dashboard cannot be accessed. |

---

## 3. System Features

### 3.1 Edge AI Detection and Tracking

#### 3.1.1 Description and Priority

**Priority: HIGH**

This is the foundational computer-vision pipeline running locally on the teacher's Windows laptop. It captures live video from the webcam and uses **YOLOv8n** to detect and track multiple students (persons) within the camera's field of view, producing bounding boxes with unique tracking IDs.

#### 3.1.2 Stimulus/Response Sequences

| Step | Actor/Stimulus | System Response |
|---|---|---|
| 1 | Teacher launches the Python edge script via PowerShell/CMD (`python main.py`). | System initializes the webcam and loads the YOLOv8n detection model. A status message "Camera initialized. Detection active." is printed to the console. |
| 2 | Students enter the camera's field of view. | YOLO detects person-class bounding boxes in each frame. The built-in tracker (e.g., BoT-SORT) assigns persistent track IDs to each individual. |
| 3 | A student momentarily leaves and re-enters the frame. | The tracker attempts to re-associate the individual with their prior track ID using motion and appearance cues. |
| 4 | Teacher stops the script (Ctrl+C or a "stop" command). | Camera is released, resources are freed, and a summary log is printed. |

#### 3.1.3 Functional Requirements

* **REQ-1:** The system shall utilize a **YOLOv8n (Nano)** model to detect person-class bounding boxes in the camera feed at a minimum of **10 FPS** on the target CPU hardware.
* **REQ-2:** The system shall assign a **persistent tracking ID** to each detected person using YOLO's built-in tracker (BoT-SORT or ByteTrack) to maintain identity across consecutive frames.
* **REQ-3:** The system shall default to `device='cpu'` for all model inference. If a CUDA-compatible GPU is detected at runtime, the system shall log a notification and optionally switch to GPU execution.
* **REQ-4:** The system shall support configurable camera input (webcam index or video file path) via command-line arguments or a configuration file.
* **REQ-5:** The system shall display an optional **debug window** (`cv2.imshow`) showing the live feed with overlaid bounding boxes and track IDs, toggleable via a configuration flag.

---

### 3.2 Behavioral and Engagement Classification

#### 3.2.1 Description and Priority

**Priority: HIGH**

For each detected student, the system crops the bounding box *Region of Interest (ROI)* and classifies the student's behavioral/engagement state using a YOLO-based image classifier (YOLOv8n-cls). The classification labels represent observable engagement levels.

#### 3.2.2 Stimulus/Response Sequences

| Step | Stimulus | System Response |
|---|---|---|
| 1 | A bounding box is detected by the detection pipeline (§3.1). | The ROI is cropped from the frame. |
| 2 | The cropped ROI is passed to the classification model. | The classifier outputs a behavioral label and a confidence score. |
| 3 | Confidence score is below the configured threshold. | The system assigns a default label of `"Unknown"` and logs the low-confidence event. |

#### 3.2.3 Functional Requirements

* **REQ-6:** The system shall classify each detected student's behavioral state into one of the following categories: `"Attentive"`, `"Distracted"`, `"Drowsy"`, or `"Unknown"`.
* **REQ-7:** The classification model shall be a **YOLOv8n-cls (Nano classification)** variant, fine-tuned or trained on a relevant engagement dataset.
* **REQ-8:** The system shall only emit a behavioral label when the classification confidence exceeds a configurable threshold (default: **0.60**). Below this threshold, the label shall be `"Unknown"`.
* **REQ-9:** Classification shall be performed **per-frame** for each tracked individual, and the most recent label shall be associated with the individual's track ID.

---

### 3.3 128-d Facial Embedding Extraction

#### 3.3.1 Description and Priority

**Priority: HIGH**

For each detected face, the system extracts a **128-dimensional mathematical vector (embedding)** that represents the individual's unique facial features. This vector is the sole piece of biometric data that leaves the edge device — it cannot be reverse-engineered into a visual likeness.

#### 3.3.2 Stimulus/Response Sequences

| Step | Stimulus | System Response |
|---|---|---|
| 1 | A person bounding box is detected (§3.1). | A face-detection sub-model locates the face within the bounding box. |
| 2 | A face is located with sufficient size and clarity. | A face-embedding model (e.g., FaceNet, ArcFace, or `dlib` shape predictor + ResNet encoder) computes the 128-d vector. |
| 3 | No face is detected within the bounding box (e.g., student facing away). | The embedding field is set to `null` for this detection. The behavioral label is still generated. |

#### 3.3.3 Functional Requirements

* **REQ-10:** The system shall extract a **128-dimensional floating-point vector** (embedding) from each detected face.
* **REQ-11:** The embedding extraction model shall run on **CPU** by default and complete within **100ms per face** on the target hardware.
* **REQ-12:** If no face is detected within a person's bounding box, the system shall set the embedding to `null` and shall not attempt identity matching for that detection cycle.
* **REQ-13:** The system shall **normalize** all extracted embeddings to unit length (L2 norm = 1.0) before transmission to ensure consistent similarity calculations.
* **REQ-14:** **No raw image data** (pixels, crops, thumbnails) shall be saved to disk, cached, or included in the transmitted payload at any point during or after embedding extraction.

---

### 3.4 Real-Time Data Transmission (Edge → Backend)

#### 3.4.1 Description and Priority

**Priority: HIGH**

The Python edge service packages the detection results (embeddings, behavioral labels, timestamps, and metadata) into a JSON payload and transmits them to the Express.js backend via HTTP POST at a configurable interval.

#### 3.4.2 Stimulus/Response Sequences

| Step | Stimulus | System Response |
|---|---|---|
| 1 | The configured transmission interval elapses (e.g., every 2 seconds). | The edge service collects all current detections into a JSON array. |
| 2 | The JSON payload is sent as an HTTP POST to the Express.js API endpoint. | The API returns `200 OK` with a receipt confirmation. |
| 3 | The network is unavailable or the API returns an error. | The edge service queues the payload locally and retries with exponential backoff. A warning is logged. |

#### 3.4.3 Functional Requirements

* **REQ-15:** The edge service shall transmit JSON payloads to the Express.js backend via **HTTP POST** at a configurable interval (default: every **2 seconds**).
* **REQ-16:** Each JSON payload shall conform to the following schema:
  ```json
  {
    "device_id": "string",
    "classroom_id": "string",
    "timestamp": "ISO 8601 string",
    "detections": [
      {
        "track_id": "integer",
        "embedding": "[128 floats] or null",
        "state": "string (Attentive|Distracted|Drowsy|Unknown)",
        "confidence": "float (0.0-1.0)",
        "bbox": "[x1, y1, x2, y2]"
      }
    ]
  }
  ```
* **REQ-17:** The edge service shall authenticate each POST request using a **pre-shared API key** included in the `Authorization` header.
* **REQ-18:** If the API endpoint is unreachable, the edge service shall **queue payloads locally** (in-memory, up to 100 payloads) and retry with **exponential backoff** (initial delay: 1s, max delay: 30s).
* **REQ-19:** The bounding box coordinates (`bbox`) in the payload shall be transmitted as **relative coordinates** (0.0–1.0), not pixel values, to decouple from camera resolution.

---

### 3.5 Identity Verification and Attendance Marking

#### 3.5.1 Description and Priority

**Priority: HIGH**

The Express.js backend receives the JSON payload, queries the Supabase `pgvector` index to find the closest matching enrolled student for each embedding, and updates the attendance records accordingly.

#### 3.5.2 Stimulus/Response Sequences

| Step | Stimulus | System Response |
|---|---|---|
| 1 | Express.js receives a valid POST payload from the edge service. | The API extracts each detection's embedding. |
| 2 | An embedding is non-null. | The API queries Supabase `pgvector` for the **nearest neighbor** within the enrolled students table, using cosine distance. |
| 3 | The closest match is within the configured similarity threshold. | The student is identified. Their attendance status is updated to `"Present"` for the current class period, and their latest engagement state is recorded. |
| 4 | The closest match exceeds the similarity threshold (no match). | The detection is logged as `"Unrecognized"`. No attendance record is created. |
| 5 | The embedding is `null`. | Identity verification is skipped. The behavioral state may still be aggregated under the track ID for general classroom analytics. |

#### 3.5.3 Functional Requirements

* **REQ-20:** The backend shall query the Supabase `pgvector` index using **cosine distance** (or optionally L2 distance) to find the nearest enrolled student embedding for each incoming 128-d vector.
* **REQ-21:** The backend shall use a configurable **similarity threshold** (default: cosine distance ≤ **0.40**) to accept or reject a match.
* **REQ-22:** Upon a successful match, the backend shall **upsert** the student's attendance record for the current date and class period, setting the status to `"Present"` and recording the timestamp of first recognition.
* **REQ-23:** Upon a successful match, the backend shall also **update** the student's latest engagement state (`state` field) in the session engagement table.
* **REQ-24:** The backend shall log all `"Unrecognized"` detections (embeddings that did not match any enrolled student above the threshold) for later review by the System Administrator.
* **REQ-25:** If a student is matched **multiple times** within the same class period, the attendance status shall remain `"Present"` (idempotent), and only the engagement state shall be updated with the latest value.

---

### 3.6 Teacher Web Dashboard — Attendance View

#### 3.6.1 Description and Priority

**Priority: HIGH**

A real-time attendance grid displayed on the React.js dashboard, showing each student's presence status for the current class period.

#### 3.6.2 Stimulus/Response Sequences

| Step | Stimulus | System Response |
|---|---|---|
| 1 | Teacher logs in and selects their class from the dashboard. | The React app subscribes to the Supabase real-time channel for that classroom's attendance table. |
| 2 | A student's attendance is marked `"Present"` in the database. | Supabase pushes the event via WebSocket. The React grid cell for that student transitions from "Absent" (red) to "Present" (green) in real time. |
| 3 | Teacher wants to manually override a student's status. | Teacher clicks the student cell and selects a manual status (e.g., "Late", "Excused"). The override is saved to the database. |

#### 3.6.3 Functional Requirements

* **REQ-26:** The dashboard shall display a **class roster grid** where each cell represents a student and shows their current attendance status (Present, Absent, Late, Excused).
* **REQ-27:** The attendance grid shall update **in real time** (within 1 second of a database change) via Supabase real-time subscriptions (WebSocket).
* **REQ-28:** The grid shall visually distinguish statuses using **color coding**: green (Present), red (Absent), yellow (Late), blue (Excused).
* **REQ-29:** Teachers shall be able to **manually override** a student's attendance status via the grid interface.
* **REQ-30:** The dashboard shall display a **summary counter** (e.g., "28/35 Present") at the top of the attendance view.

---

### 3.7 Teacher Web Dashboard — Engagement Heatmap

#### 3.7.1 Description and Priority

**Priority: MEDIUM**

A live socio-emotional heatmap representing the real-time engagement state of the classroom, aggregated from the behavioral classifications pushed by the edge device.

#### 3.7.2 Stimulus/Response Sequences

| Step | Stimulus | System Response |
|---|---|---|
| 1 | Engagement state updates arrive in the database for multiple students. | Supabase pushes updates via real-time subscription. |
| 2 | The React dashboard receives the updates. | The heatmap visualization re-renders, adjusting the color/intensity for each student's tile based on their current state. |
| 3 | Teacher hovers over a student's tile on the heatmap. | A tooltip displays the student's name, current state, and the timestamp of the last update. |

#### 3.7.3 Functional Requirements

* **REQ-31:** The dashboard shall display a **socio-emotional heatmap** representing each student's current engagement state.
* **REQ-32:** Heatmap tiles shall be color-coded: green (Attentive), orange (Distracted), red (Drowsy), grey (Unknown/No Data).
* **REQ-33:** The heatmap shall update **in real time** via Supabase subscriptions.
* **REQ-34:** Hovering over a heatmap tile shall display a **tooltip** with the student's name, current state, and last-updated timestamp.
* **REQ-35:** The dashboard shall display an **aggregate engagement score** (e.g., "72% Attentive") for the entire class.

---

### 3.8 User Authentication and Role Management

#### 3.8.1 Description and Priority

**Priority: HIGH**

The system must authenticate users and enforce role-based access control (RBAC) to protect sensitive student data.

#### 3.8.2 Stimulus/Response Sequences

| Step | Stimulus | System Response |
|---|---|---|
| 1 | User navigates to the React dashboard URL. | The app checks for an active Supabase Auth session. If none exists, it redirects to the login page. |
| 2 | User enters valid credentials. | Supabase Auth validates the credentials and returns a JWT. The React app stores the session and renders the dashboard based on the user's role. |
| 3 | A user with the "Teacher" role attempts to access admin-only analytics. | The system denies access and displays an "Unauthorized" message. |

#### 3.8.3 Functional Requirements

* **REQ-36:** The system shall use **Supabase Auth** for user authentication (email/password).
* **REQ-37:** The system shall enforce **role-based access control** with the following roles: `Teacher`, `Admin`, `SystemAdmin`.
* **REQ-38:** `Teacher` role shall have access to: their own class attendance grid, engagement heatmap, and manual attendance override.
* **REQ-39:** `Admin` role shall have access to: all teacher views plus school-wide aggregate analytics and student roster management.
* **REQ-40:** `SystemAdmin` role shall have access to: all admin views plus device management, API key configuration, and system logs.
* **REQ-41:** Unauthenticated users shall be **redirected to the login page** and shall not be able to access any dashboard data.

---

## 4. External Interface Requirements

### 4.1 User Interfaces

#### 4.1.1 React Teacher Dashboard

* **Layout:** Single-page application with a sidebar navigation and a main content area.
* **Attendance View:** A responsive grid layout showing student cards with color-coded status indicators.
* **Engagement Heatmap:** A tile-based visualization (similar to a seating chart) with color gradients representing engagement levels.
* **Navigation:** Sidebar with links to: Home, Attendance, Engagement, Settings.
* **Responsive Design:** The dashboard shall be usable on screens from 1024px width (laptop) upward.
* **Accessibility:** Color-coded elements shall also include text labels or icons for users with color vision deficiencies.

#### 4.1.2 Edge Script CLI

* The Python edge script shall be operated via **Windows PowerShell** or **Command Prompt**.
* Console output shall include: initialization status, FPS counter, detection count per frame, and transmission status.
* An optional **debug visualization window** (`cv2.imshow`) shall show the live camera feed with bounding boxes, track IDs, and state labels overlaid. This window must be **toggleable** via a `--debug` command-line flag.

### 4.2 Hardware Interfaces

| Interface | Description |
|---|---|
| **Camera** | The Python edge script communicates with standard **USB webcams** or integrated laptop cameras via **OpenCV's `cv2.VideoCapture` API** on Windows. Supported resolutions: 640x480 (default) to 1280x720. |
| **CPU/GPU** | Inference runs on the system CPU via PyTorch's CPU backend. If an NVIDIA CUDA GPU is detected, the system may optionally switch to GPU inference for improved performance. |

### 4.3 Software Interfaces

| Interface | Components | Data Exchanged | Protocol |
|---|---|---|---|
| **Edge to Express API** | Python (client) to Express.js (server) | JSON payload (see REQ-16 schema) | HTTPS POST |
| **Express to Supabase** | Express.js (client) to Supabase PostgreSQL | SQL queries (including `pgvector` similarity searches), CRUD operations | Supabase JS Client Library (REST + WebSocket under the hood) |
| **Supabase to React** | Supabase Realtime to React app | Real-time database change events (INSERT, UPDATE on attendance/engagement tables) | WebSocket (Supabase Realtime) |
| **Supabase Auth** | React app and Supabase Auth | Login credentials, JWTs, session tokens | HTTPS (Supabase Auth API) |

### 4.4 Communications Interfaces

* **HTTP/HTTPS (REST):** All communication between the Python edge service and the Express.js API shall use HTTPS with TLS 1.2+. During local development, HTTP may be used.
* **WebSocket:** Real-time data feeds between Supabase and the React frontend use the Supabase Realtime service, which operates over WebSocket connections.
* **Data Format:** All payloads are JSON-encoded. Character encoding is UTF-8.
* **Message Size:** A typical JSON payload containing 40 student detections is approximately **25–30 KB**. The system shall support payloads up to **100 KB**.
* **Transfer Rate:** At the default 2-second transmission interval, the average upload bandwidth required is approximately **12–15 KB/s**.

---

## 5. Other Nonfunctional Requirements

### 5.1 Performance Requirements

| ID | Requirement | Target | Rationale |
|---|---|---|---|
| **NFR-1** | Edge inference framerate | >= **10 FPS** on Acer Aspire 3 CPU (Intel i3/i5 class) | Minimum viable speed for tracking student movements and maintaining tracker ID persistence. |
| **NFR-2** | Embedding extraction latency | <= **100ms per face** on CPU | Must not create a bottleneck that drops overall FPS below the target. |
| **NFR-3** | End-to-end latency (capture to dashboard update) | <= **3 seconds** | Teachers need near-real-time feedback to trust the system's data. |
| **NFR-4** | API response time (Express to Supabase pgvector query) | <= **500ms** per payload (batch of up to 40 embeddings) | Prevents queue buildup on the backend. |
| **NFR-5** | Dashboard real-time update latency | <= **1 second** from database write to UI render | Supabase Realtime typically delivers within 200–500ms. |
| **NFR-6** | Concurrent dashboard users | Support >= **10 simultaneous** teacher/admin sessions | Multiple teachers across a school may use the dashboard concurrently. |
| **NFR-7** | Maximum students per classroom | >= **40 students** detected and tracked simultaneously | Upper bound for typical Malaysian primary school classroom size. |

### 5.2 Safety Requirements

| ID | Requirement | Description |
|---|---|---|
| **NFR-8** | **Child Safety** | The system processes data about minors (primary school students aged 7–12). All data handling must adhere to the principle of **data minimization** — collect and store only the absolute minimum required (128-d vectors and text labels). |
| **NFR-9** | **No Identifiable Media** | Under no circumstance shall the system produce, store, or transmit photo/video content that could identify a minor. Violation of this constraint is a **critical system failure**. |
| **NFR-10** | **Fail-Safe Behavior** | If the edge script encounters an unrecoverable error during inference, it shall **terminate gracefully**, release the camera, and ensure no temporary image files are left on disk. |
| **NFR-11** | **Teacher Override** | The system shall always allow a teacher to manually override AI-generated attendance or engagement data, ensuring the human remains the final authority. |

### 5.3 Security Requirements

| ID | Requirement | Description |
|---|---|---|
| **NFR-12** | **Authentication** | All users must authenticate via **Supabase Auth** (email/password) before accessing the React dashboard. |
| **NFR-13** | **API Authentication** | The Express.js API shall validate a **pre-shared API key** (sent via the `Authorization` header) on every request from the edge device. Invalid keys shall result in a `401 Unauthorized` response. |
| **NFR-14** | **HTTPS Enforcement** | All production communications between the edge device and the Express.js API shall use **HTTPS (TLS 1.2+)**. |
| **NFR-15** | **Row-Level Security (RLS)** | Supabase RLS policies shall ensure that Teachers can only access attendance and engagement data for **their own assigned classes**. |
| **NFR-16** | **JWT Validation** | The Express.js backend shall validate Supabase-issued JWTs on requests from the React frontend to prevent unauthorized API access. |
| **NFR-17** | **Secret Management** | API keys, database connection strings, and Supabase service keys shall be stored in **environment variables** (`.env` files), never hardcoded in source code. |

### 5.4 Privacy Requirements

| ID | Requirement | Description |
|---|---|---|
| **NFR-18** | **No Raw Image Persistence** | Raw pixel data from the camera shall exist **only in volatile memory (RAM)** during the inference cycle. It shall never be written to disk, cached, logged, or transmitted. |
| **NFR-19** | **Embedding Irreversibility** | The 128-d embeddings stored in the database are mathematical representations that **cannot be reverse-engineered** into a facial image. This property shall be documented and communicated to stakeholders. |
| **NFR-20** | **Data Retention Policy** | Attendance and engagement records shall be retained for the **current academic year**. At the end of each academic year, historical data older than 12 months should be archived or purged per the school's data policy. |
| **NFR-21** | **Consent** | Student enrollment (embedding capture) shall only be performed with **documented parental/guardian consent**. The enrollment process and consent requirements are outside the scope of this software but are a prerequisite for system use. |

### 5.5 Software Quality Attributes

| Quality Attribute | Requirement | Metric |
|---|---|---|
| **Portability** | While targeted at Windows OS, the Python edge code shall use **OS-agnostic libraries** (OpenCV, PyTorch, Ultralytics) and avoid Windows-specific APIs where possible. | Edge script runs on macOS/Linux with <= 1 hour of configuration changes. |
| **Robustness** | The edge script shall **automatically reconnect** to the Express.js API if the network connection drops. | Successful reconnection within 30 seconds of network restoration. |
| **Usability** | The React dashboard shall be intuitive enough for a non-technical teacher to use **without training beyond the Quick-Start Guide**. | New user can complete core tasks (view attendance, view heatmap) within 2 minutes. |
| **Maintainability** | Code shall follow consistent style guides (PEP 8 for Python, ESLint/Prettier for JS). Modules shall be loosely coupled. | Code review checklist compliance >= 90%. |
| **Testability** | All functional requirements (REQ-1 through REQ-41) shall have **corresponding test cases**. | 100% requirement-to-test-case coverage in the Test Plan. |
| **Reliability** | The edge script shall operate **continuously for at least 8 hours** (a full school day) without memory leaks or crashes. | Zero unhandled exceptions during an 8-hour soak test. |

---

## 6. Other Requirements

### 6.1 Database Requirements

* **PostgreSQL Version:** The Supabase instance shall run PostgreSQL 15 or later with the `pgvector` extension enabled.
* **Embedding Storage:** Student enrollment embeddings shall be stored in a `vector(128)` column in the `students` table, indexed with an **IVFFlat** or **HNSW** index for efficient nearest-neighbor queries.
* **Schema Overview (key tables):**

| Table | Key Columns | Purpose |
|---|---|---|
| `students` | `id`, `name`, `class_id`, `embedding vector(128)` | Enrolled student profiles with face embeddings. |
| `classes` | `id`, `name`, `teacher_id`, `schedule` | Class/section definitions. |
| `attendance` | `id`, `student_id`, `class_id`, `date`, `period`, `status`, `first_seen_at` | Daily attendance records. |
| `engagement_logs` | `id`, `student_id`, `class_id`, `state`, `confidence`, `timestamp` | Per-interval engagement state records. |
| `users` | `id` (Supabase Auth UID), `role`, `display_name` | Teachers, admins, system admins. |
| `devices` | `id`, `classroom_id`, `api_key_hash`, `last_seen` | Registered edge devices. |

### 6.2 Internationalization Requirements

* The React dashboard shall initially support **English (en)** as the primary language.
* UI text shall be organized in a localization-ready structure (e.g., i18n JSON files) to facilitate future translation into **Bahasa Malaysia (ms)**.

### 6.3 Legal and Compliance

* The system shall comply with Malaysia's **Personal Data Protection Act 2010 (PDPA)** regarding the processing of personal data (128-d embeddings) of minors.
* Parental consent documentation (outside software scope) is a prerequisite for enrollment.

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| **PRISM-AI** | Primary School Intelligent Student Management and Predictive Analytics Ecosystem. |
| **Edge Device** | The classroom laptop (Acer Aspire 3) running the Python inference script locally. |
| **YOLO** | "You Only Look Once" — a family of real-time object detection models. |
| **YOLOv8n** | The "Nano" variant of YOLOv8, optimized for speed on resource-constrained hardware. |
| **ROI (Region of Interest)** | The bounding box area in an image frame where a student has been detected. |
| **128-d Embedding** | A 128-dimensional floating-point vector representing unique facial features, computed in a way that prevents reconstruction of the original image. |
| **pgvector** | A PostgreSQL extension for storing, indexing, and querying vector embeddings efficiently. |
| **Cosine Distance** | A distance metric measuring the angular difference between two vectors; used for embedding similarity matching. |
| **Supabase** | An open-source Backend-as-a-Service platform built on PostgreSQL, providing Auth, Realtime subscriptions, and database hosting. |
| **JWT** | JSON Web Token — a compact, URL-safe token format used for authentication and authorization. |
| **RLS** | Row-Level Security — a PostgreSQL feature that restricts which rows a user can access based on policies. |
| **SPA** | Single Page Application — a web app that dynamically rewrites the current page rather than loading entire new pages. |
| **RAD** | Rapid Application Development — an agile-like methodology emphasizing quick prototyping and iterative delivery. |
| **FPS** | Frames Per Second — the number of video frames processed by the inference pipeline per second. |
| **BoT-SORT / ByteTrack** | Multi-object tracking algorithms integrated into YOLO for assigning persistent IDs to detected objects across frames. |
| **Education 5.0** | A paradigm emphasizing the integration of AI, IoT, and human-centric technology in educational environments. |
| **SDG 4.1** | United Nations Sustainable Development Goal 4, Target 4.1: By 2030, ensure all children complete quality primary education. |
| **PDPA** | Personal Data Protection Act 2010 — Malaysia's personal data protection legislation. |

---

## Appendix B: Analysis Models

### B.1 System Architecture Diagram

*(Refer to the Context Diagram in Section 2.1 for the high-level view.)*

### B.2 Data Flow Diagram (Level 0)

```
┌──────────┐                                          ┌─────────────┐
│  Webcam   │──── Video Frames ───▶ [P1: YOLO         │             │
│  (Camera) │                       Detection &       │  Express.js │
└──────────┘                       Classification]    │  API Server │
                                        │             │             │
                                        │ JSON        └──────┬──────┘
                                        │ Payload            │
                                        ▼                    │ SQL/pgvector
                                  [P2: Embedding       ┌─────▼──────┐
                                   Extraction &        │  Supabase   │
                                   Transmission] ────▶ │  PostgreSQL │
                                                       │  + pgvector │
                                                       └──────┬──────┘
                                                              │
                                                              │ Realtime
                                                              │ (WebSocket)
                                                              ▼
                                                       ┌─────────────┐
                                                       │  React.js   │
                                                       │  Dashboard  │
                                                       └─────────────┘
```

### B.3 Data Flow Diagram (Level 1 — Edge Process Detail)

```
Camera Frame
     │
     ▼
[1.1 YOLOv8n Person Detection]
     │
     ├───── Bounding Boxes ─────▶ [1.2 BoT-SORT Tracking] ──▶ Track IDs
     │                                                              │
     ├───── ROI Crops ──────────▶ [1.3 YOLOv8n-cls Behavioral     │
     │                                  Classification] ──▶ State Labels
     │                                                              │
     └───── Face Crops ─────────▶ [1.4 Face Embedding              │
                                       Extraction] ──▶ 128-d Vectors
                                                                    │
                                                         ┌──────────▼──────────┐
                                                         │  [1.5 JSON Payload  │
                                                         │   Assembly &        │
                                                         │   HTTP POST]        │
                                                         └─────────────────────┘
```

### B.4 Entity-Relationship Diagram (Simplified)

```
┌──────────┐       ┌──────────────┐       ┌────────────────┐
│  users   │       │   classes    │       │   students     │
│──────────│       │──────────────│       │────────────────│
│ id (PK)  │──┐    │ id (PK)      │──┐    │ id (PK)        │
│ role     │  └───▶│ teacher_id(FK│  │    │ name           │
│ name     │       │ name         │  └───▶│ class_id (FK)  │
│ email    │       │ schedule     │       │ embedding(128) │
└──────────┘       └──────┬───────┘       └───────┬────────┘
                          │                       │
                          │                       │
                   ┌──────▼───────┐        ┌──────▼──────────┐
                   │  attendance  │        │ engagement_logs │
                   │──────────────│        │─────────────────│
                   │ id (PK)      │        │ id (PK)         │
                   │ student_id   │        │ student_id (FK) │
                   │ class_id(FK) │        │ class_id (FK)   │
                   │ date         │        │ state           │
                   │ period       │        │ confidence      │
                   │ status       │        │ timestamp       │
                   │ first_seen_at│        └─────────────────┘
                   └──────────────┘
```

### B.5 Use Case Diagram (Primary Actors)

```
                          ┌───────────────────────────────────────┐
                          │           PRISM-AI System              │
    ┌────────┐            │                                       │
    │Teacher │───────────▶│  UC1: Start/Stop Edge Script          │
    │        │───────────▶│  UC2: View Attendance Grid            │
    │        │───────────▶│  UC3: Override Attendance Status      │
    │        │───────────▶│  UC4: View Engagement Heatmap         │
    │        │───────────▶│  UC5: Login / Logout                  │
    └────────┘            │                                       │
                          │                                       │
    ┌────────┐            │                                       │
    │ Admin  │───────────▶│  UC6: View School-Wide Analytics      │
    │        │───────────▶│  UC7: Manage Student Roster           │
    │        │───────────▶│  UC8: Manage Class Assignments        │
    └────────┘            │                                       │
                          │                                       │
    ┌────────┐            │                                       │
    │SysAdmin│───────────▶│  UC9: Configure Edge Devices          │
    │        │───────────▶│  UC10: Manage API Keys                │
    │        │───────────▶│  UC11: View System Logs               │
    └────────┘            │                                       │
                          └───────────────────────────────────────┘
```

---

## Appendix C: Issues List

The following is a dynamic list of open requirements issues, pending decisions, and items requiring further investigation.

| ID | Issue | Status | Priority | Notes |
|---|---|---|---|---|
| ISS-1 | **Engagement classification dataset.** Which dataset will be used to fine-tune the YOLOv8n-cls model for behavior classification? Options: DAiSEE, custom-collected, or a hybrid. | **Open** | High | Directly impacts REQ-6 and REQ-7 accuracy. |
| ISS-2 | **Face embedding model selection.** Which model will be used for 128-d extraction? Candidates: `dlib` (ResNet), FaceNet (InceptionResNetV1), ArcFace. Must evaluate CPU inference speed vs. accuracy. | **Open** | High | Affects REQ-10 and REQ-11 performance targets. |
| ISS-3 | **Similarity threshold calibration.** The cosine distance threshold (REQ-21, default 0.40) needs empirical validation with real student data. | **Open** | Medium | Too low = false rejections; too high = false matches. |
| ISS-4 | **Student enrollment workflow.** How will initial face embeddings be captured and stored? A dedicated enrollment script/UI is needed but not yet designed. | **Open** | High | Prerequisite for Section 3.5 identity verification. |
| ISS-5 | **Multi-camera support.** v1.0 assumes a single camera per classroom. Should the schema support multiple cameras per room for future scalability? | **Deferred (v2.0)** | Low | Schema design in Section 6.1 should be forward-compatible. |
| ISS-6 | **Offline mode.** If internet is unavailable for an extended period, should the edge device store attendance locally and sync when reconnected? Currently, REQ-18 handles short-term queueing only. | **Open** | Medium | Impacts reliability in schools with unstable internet. |
| ISS-7 | **PDPA compliance review.** Has a formal legal review been conducted to ensure the 128-d embedding storage and processing model complies with the PDPA? | **Open** | High | Legal requirement (Section 6.3). |
| ISS-8 | **Supabase plan limits.** Need to confirm that the chosen Supabase plan (Free vs. Pro) supports the required number of real-time connections, database size, and `pgvector` usage. | **Open** | Medium | Dependency A3. |

---

*— End of Document —*
