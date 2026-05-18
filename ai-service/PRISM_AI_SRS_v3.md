# Software Requirements Specification

## for

# PRISM-AI

### (Primary School Intelligent Student Management and Predictive Analytics Ecosystem)

**Version 3.0**

**Prepared by:** Hazwan Harith  
**Organization:** Faculty of Computing, Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA)  
**Date Created:** 17 April 2026

---

## Revision History

| Name | Date | Reason For Changes | Version |
|---|---|---|---|
| Hazwan Harith | 13 April 2026 | Initial draft created from project blueprint | 1.0 |
| Hazwan Harith | 17 April 2026 | Expanded to full IEEE 830 compliance with 41 FRs and 21 NFRs | 2.0 |
| Hazwan Harith | 17 April 2026 | Complete rewrite aligned to the official PRISM-AI Use Case Diagram. Added Parent actor, Parent Portal (UC24–UC26), AI Emotion & Risk Engine (UC20–UC23, UC28), Student Management (UC08–UC10), and System Administration (UC11–UC14). Total: 62 FRs, 21 NFRs, 28 Use Cases. | 3.0 |

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
   - 3.1 [Authentication (UC00)](#31-authentication-uc00)
   - 3.2 [Teacher Operations (UC01–UC06)](#32-teacher-operations-uc01uc06)
   - 3.3 [Student Management (UC08–UC10)](#33-student-management-uc08uc10)
   - 3.4 [System Administration (UC11–UC14)](#34-system-administration-uc11uc14)
   - 3.5 [AI: Attendance Module (UC15–UC19)](#35-ai-attendance-module-uc15uc19)
   - 3.6 [AI: Emotion & Risk Engine (UC20–UC23, UC28)](#36-ai-emotion--risk-engine-uc20uc23-uc28)
   - 3.7 [Parent Portal (UC24–UC26)](#37-parent-portal-uc24uc26)
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
4. **Frontend Client** (React.js) — the web-based dashboard consumed by teachers, administrators, and parents.

This document is intended to serve as the **single authoritative reference** for all development, testing, and acceptance activities throughout the Rapid Application Development (RAD) lifecycle.

### 1.2 Document Conventions

This document follows the **IEEE Std 830-1998** (IEEE Recommended Practice for Software Requirements Specifications) structure with the following conventions:

* **Bold** text denotes system entities, component names, or critical constraints.
* *Italic* text denotes defined terms (see Appendix A: Glossary).
* Each functional requirement is tagged with a unique identifier in the format `REQ-<number>` to ensure full traceability from requirements to design to test cases.
* Each use case is tagged with a unique identifier in the format `UC<number>` corresponding directly to the official PRISM-AI Use Case Diagram.
* Priority inheritance: Unless explicitly overridden, a detailed requirement inherits the priority level of its parent System Feature.
* Requirement priority levels used: **High** (must-have for v1.0), **Medium** (should-have), **Low** (nice-to-have / deferred to v2.0).

### 1.3 Intended Audience and Reading Suggestions

This document serves the following audiences:

| Audience | Recommended Sections | Rationale |
|---|---|---|
| **AI/ML Engineers** | S1, S2.4-2.5, S3.5-3.6, S5.1 | YOLO pipeline constraints, CPU optimization targets, embedding and emotion engine specifications. |
| **Backend Developers** | S3.1, S3.4-3.5, S4.3-4.4, S5.3 | API design, pgvector queries, authentication, and data-transmission protocols. |
| **Frontend Developers** | S3.2, S3.3, S3.7, S4.1, S5.1 | Dashboard components, parent portal, real-time subscriptions, UX expectations. |
| **Project Supervisor / Examiner** | S1-2, S5, Appendix B | High-level scope, architecture diagrams, use case diagram reference, and quality attributes. |
| **School Administrators** | S1.4, S2.1-2.3, S3.4, S5.2-5.4 | Value proposition, user roles, system admin features, and child-safety/privacy guarantees. |
| **QA / Testers** | S3 (all), S5 | Every REQ identifier maps to a testable acceptance criterion. |

**Suggested reading order:** Begin with S1 and S2 for context, then proceed to S3 for detailed features organized by actor, and finally S5 for quality-gate criteria.

### 1.4 Project Scope

PRISM-AI addresses two critical inefficiencies identified in Malaysian primary-school administration:

1. **The "Visibility Gap"** — Manual attendance taking across multiple class periods wastes an estimated **15-20 minutes daily** per teacher and remains prone to human error and proxy attendance.
2. **The "Engagement Gap"** — A single teacher physically cannot objectively monitor the participation and emotional state of **20+ students** simultaneously, leading to disengaged or at-risk students going unnoticed.

**PRISM-AI's solution** is an edge-AI ecosystem that:

* Automates attendance via real-time facial recognition running on a teacher's existing laptop.
* Provides objective, live engagement analytics (socio-emotional heatmaps) on a web dashboard.
* Detects at-risk behavioral patterns and flags them proactively via the Emotion & Risk Engine.
* Keeps parents informed through a dedicated Parent Portal with attendance history and alerts.
* Strictly preserves minor data privacy by processing video locally and **never saving or transmitting raw images** — only 128-dimensional mathematical vectors and behavioral labels leave the edge device.

**Alignment:**
* **Education 5.0** — Leveraging AI/IoT to enhance the classroom experience without replacing the teacher.
* **UN SDG Goal 4.1** — Ensure inclusive and equitable quality primary education.

**Out of scope for v1.0:** Predictive grade analytics, multi-camera orchestration, cloud-based model training, mobile native apps.

### 1.5 References

| # | Reference | Description |
|---|---|---|
| R1 | PRISM-AI System Context & Project Blueprint Document | Internal architecture specification provided to the development team. |
| R2 | PRISM-AI Use Case Diagram v1.0 | Official use case diagram defining 4 actors, 28 use cases, and their relationships. |
| R3 | IEEE Std 830-1998 | IEEE Recommended Practice for Software Requirements Specifications. |
| R4 | Ultralytics YOLOv8 Documentation (https://docs.ultralytics.com) | Official documentation for the YOLO model family used in this project. |
| R5 | Supabase Documentation (https://supabase.com/docs) | Platform documentation for PostgreSQL hosting, Auth, Realtime, and `pgvector`. |
| R6 | `pgvector` Extension (https://github.com/pgvector/pgvector) | PostgreSQL extension for storing and querying vector embeddings. |
| R7 | React.js Documentation (https://react.dev) | Official React documentation for frontend component architecture. |
| R8 | Express.js Documentation (https://expressjs.com) | Official Express.js API reference for the backend server. |
| R9 | OpenCV Python Documentation (https://docs.opencv.org) | Computer vision library used for camera capture and image preprocessing. |
| R10 | PyTorch Documentation (https://pytorch.org/docs) | Deep learning framework — CPU-optimized build used for inference. |

---

## 2. Overall Description

### 2.1 Product Perspective

PRISM-AI is a **new, self-contained ecosystem** — it is not a replacement for or extension of any existing school management software. The system is composed of two physically separated tiers that communicate over standard HTTP:

1. **Edge Tier (Classroom Laptop):** A Python 3.12 service that controls the local webcam, runs all AI inference (YOLO detection, behavioral classification, emotion analysis, embedding extraction) on the device CPU, and pushes lightweight JSON payloads to the cloud.

2. **Cloud Tier (Web Services):** An Express.js API gateway, a Supabase PostgreSQL database (with `pgvector` for vector similarity), and a React.js single-page application (SPA) served to teacher, admin, and parent browsers.

**Context Diagram:**

```
┌─────────────────────────────────────────────────────────┐
│                    CLASSROOM (Edge)                      │
│  ┌──────────┐    ┌───────────────────────────────────┐  │
│  │  Webcam   │───>│  Python Edge Service               │  │
│  └──────────┘    │  [AI: Attendance Module]            │  │
│                  │  • UC15: Capture Camera Feed        │  │
│                  │  • UC16: Run Facial Detection       │  │
│                  │  • UC17: Match Facial Embeddings    │  │
│                  │  • UC18: Mark Attendance             │  │
│                  │  [AI: Emotion & Risk Engine]        │  │
│                  │  • UC20: Analyze Student Behavior   │  │
│                  │  • UC21: Classify Emotion States    │  │
│                  │  • UC22: Detect At-Risk Patterns    │  │
│                  └──────────────┬────────────────────┘  │
│                                 │ JSON POST              │
└─────────────────────────────────┼───────────────────────┘
                                  │ HTTPS
┌─────────────────────────────────┼───────────────────────┐
│                    CLOUD TIER   v                        │
│  ┌───────────────────────────────────┐                  │
│  │      Express.js API Gateway       │                  │
│  │  • UC19: Send Attendance Notifs   │                  │
│  │  • UC23: Generate Emotion Report  │                  │
│  │  • UC28: Push WebSocket Events    │                  │
│  └──────────────┬────────────────────┘                  │
│                 │                                        │
│  ┌──────────────v────────────────────┐                  │
│  │   Supabase (PostgreSQL + pgvector)│                  │
│  │  • UC00: Auth / Login-Logout      │                  │
│  │  • Student embeddings & records   │                  │
│  │  • Attendance & engagement data   │                  │
│  │  • Real-time event broadcasting   │                  │
│  └──────────────┬────────────────────┘                  │
│                 │ WebSocket (Realtime)                   │
│  ┌──────────────v────────────────────┐                  │
│  │       React.js Dashboard (SPA)    │                  │
│  │  [Teacher Operations]             │                  │
│  │  • UC01–UC06                      │                  │
│  │  [Student Management]             │                  │
│  │  • UC08–UC10                      │                  │
│  │  [System Administration]          │                  │
│  │  • UC11–UC14                      │                  │
│  │  [Parent Portal]                  │                  │
│  │  • UC24–UC26                      │                  │
│  └───────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Product Features

The following is a high-level summary of the major product features, organized by the functional groups defined in the Use Case Diagram. Detailed requirements are specified in S3.

| Group | Use Cases | Description |
|---|---|---|
| **Authentication** | UC00 | Secure login/logout for all user roles via Supabase Auth. |
| **Teacher Operations** | UC01–UC06 | Real-time attendance grid, engagement reports, heatmap, AI dashboard, student alerts, and manual overrides. |
| **Student Management** | UC08–UC10 | Student enrollment (including face embedding capture), profile viewing, and record editing. |
| **System Administration** | UC11–UC14 | User account management, system configuration, log viewing, and school-wide report generation. |
| **AI: Attendance Module** | UC15–UC19 | Edge camera capture, YOLO face detection, embedding matching, auto-attendance marking, and notification dispatch. |
| **AI: Emotion & Risk Engine** | UC20–UC23, UC28 | Behavioral analysis, emotion classification, at-risk pattern detection, emotion analytics reports, and real-time WebSocket event pushing. |
| **Parent Portal** | UC24–UC26 | Attendance history viewing, alert/notification reception, and student progress reports. |

### 2.3 User Classes and Characteristics

| User Class | Frequency of Use | Technical Expertise | Primary Use Cases | Priority |
|---|---|---|---|---|
| **Teacher** | Daily, during every class period | Low — expects simple, non-intrusive UI | UC00–UC06, UC08–UC10 | **Primary** (favored user) |
| **System Administrator** | During setup and maintenance | High | UC00, UC08–UC14 | **Secondary** |
| **Parent** | Weekly / on-demand | Low — mobile-friendly web access | UC00, UC24–UC26 | **Secondary** |
| **AI System (Subsystem)** | Continuous (automated) | N/A — autonomous software agent | UC15–UC23, UC28 | **Internal** (non-human actor) |

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
| C8 | The system must support **4 distinct user roles**: Teacher, System Administrator, Parent, and AI System (internal). | As defined in the Use Case Diagram. |

### 2.6 User Documentation

The following documentation deliverables shall accompany the software:

| Document | Format | Description |
|---|---|---|
| **Edge Setup Guide** | PDF / Markdown | Step-by-step instructions for installing Python 3.12, creating a virtual environment, installing dependencies (`requirements.txt`), configuring the webcam, and running the inference script on a Windows machine. |
| **Teacher's Quick-Start Guide** | PDF (single page) | A one-page visual guide showing how to start the edge script, log in to the dashboard, and interpret the attendance grid and heatmap. |
| **Parent Portal Guide** | PDF (single page) | A one-page guide explaining how parents can log in, view their child's attendance history, read alerts, and access progress reports. |
| **System Administrator Manual** | PDF / Markdown | Covers Supabase project setup, `pgvector` configuration, Express.js deployment, environment variable configuration, user account management, and API key management. |
| **In-App Help Tooltips** | React components | Contextual tooltips within the React dashboard explaining UI elements (e.g., heatmap color legend, attendance status icons, alert severity levels). |

### 2.7 Assumptions and Dependencies

| ID | Assumption / Dependency | Type | Risk if Invalid |
|---|---|---|---|
| A1 | Classrooms have a **stable internet connection** (minimum 1 Mbps upload) to transmit JSON payloads to the Supabase backend. | Assumption | Edge data will queue locally and may cause stale dashboard data. |
| A2 | The classroom webcam provides **adequate lighting and resolution** (minimum 720p) for YOLO to detect faces at typical classroom distances (1-5 meters). | Assumption | Detection accuracy will degrade; false negatives increase. |
| A3 | **Supabase** free/pro tier provides sufficient database storage, `pgvector` support, and real-time connection slots for the prototype phase. | Dependency | May need to migrate to self-hosted PostgreSQL. |
| A4 | The **Ultralytics YOLOv8** library and pre-trained Nano weights remain freely available under their current AGPL-3.0 license for academic use. | Dependency | Would require sourcing an alternative detection model. |
| A5 | Student **enrollment** (name, class, and initial face embedding) is performed as a one-time setup before the system goes live in a classroom. | Assumption | Without enrollment data, identity verification cannot function. |
| A6 | A maximum of **40 students** are present in any single classroom at one time. | Assumption | Exceeding this may impact CPU inference speed and tracking accuracy. |
| A7 | Teachers have access to a **modern web browser** (Chrome, Edge, or Firefox) on a device separate from or the same as the edge laptop. | Assumption | Dashboard cannot be accessed. |
| A8 | **Parents** have provided documented consent for their child's facial embedding enrollment and have been given login credentials to the Parent Portal. | Assumption | Parent portal features and enrollment cannot proceed without consent. |

---

## 3. System Features

> **Traceability Note:** Every subsection below maps directly to a Use Case (UC) from the official PRISM-AI Use Case Diagram. The mapping is: Section number -> UC group -> individual UC IDs -> REQ IDs.

---

### 3.1 Authentication (UC00)

#### 3.1.1 Description and Priority

**Priority: HIGH** | **Use Case:** UC00 — Login/Logout

This feature provides secure authentication for all system users (Teachers, System Administrators, and Parents). It is included (`<<include>>`) by all other use cases that require user interaction with the web dashboard. The AI System subsystem authenticates via API key rather than user credentials.

#### 3.1.2 Stimulus/Response Sequences

| Step | Actor/Stimulus | System Response |
|---|---|---|
| 1 | Any user navigates to the PRISM-AI dashboard URL. | The system checks for an active Supabase Auth session. If no session exists, the login page is displayed. |
| 2 | User enters email and password and clicks "Login". | Supabase Auth validates credentials. On success: a JWT is issued, the session is stored, and the user is redirected to their role-appropriate dashboard view. On failure: an error message is displayed. |
| 3 | User clicks "Logout". | The session is destroyed, the JWT is invalidated, and the user is redirected to the login page. |
| 4 | A user's JWT expires during an active session. | The system attempts a silent token refresh. If the refresh fails, the user is redirected to the login page with a "Session expired" message. |

#### 3.1.3 Functional Requirements

* **REQ-01:** The system shall use **Supabase Auth** for user authentication using email and password credentials.
* **REQ-02:** Upon successful login, the system shall issue a **JSON Web Token (JWT)** and store the session on the client side.
* **REQ-03:** The system shall enforce **role-based access control (RBAC)** with the following roles: `Teacher`, `Admin` (System Administrator), and `Parent`.
* **REQ-04:** After login, the system shall redirect the user to their **role-appropriate default view**: Teachers to the Attendance Grid, Admins to the System Dashboard, Parents to the Attendance History.
* **REQ-05:** The system shall provide a **Logout** function that destroys the session, invalidates the token, and redirects to the login page.
* **REQ-06:** Unauthenticated users shall be **blocked from accessing** any dashboard page and redirected to the login screen.
* **REQ-07:** The system shall support **automatic session refresh** using Supabase's token refresh mechanism to maintain active sessions without requiring re-login.

---

### 3.2 Teacher Operations (UC01–UC06)

#### 3.2.1 UC01 — View Real-Time Attendance Grid

##### Description and Priority

**Priority: HIGH**

The teacher views a live-updating attendance grid showing each student's presence status for the current class period. The grid updates in real time as the AI Attendance Module (UC15–UC18) identifies students.

##### Stimulus/Response Sequences

| Step | Actor/Stimulus | System Response |
|---|---|---|
| 1 | Teacher logs in and selects their class from the dashboard. | The React app subscribes to the Supabase real-time channel for that classroom's attendance table. The attendance grid renders showing all enrolled students. |
| 2 | The AI module marks a student as "Present" in the database. | Supabase pushes the event via WebSocket. The grid cell transitions from "Absent" (red) to "Present" (green) without page refresh. |
| 3 | Teacher selects a different class period from a dropdown. | The grid re-fetches and re-subscribes for the selected period's data. |

##### Functional Requirements

* **REQ-08:** The dashboard shall display a **class roster grid** where each cell represents a student and shows their current attendance status: Present, Absent, Late, or Excused.
* **REQ-09:** The attendance grid shall update **in real time** (within 1 second of a database change) via Supabase real-time subscriptions (WebSocket).
* **REQ-10:** The grid shall visually distinguish statuses using **color coding**: green (Present), red (Absent), yellow (Late), blue (Excused).
* **REQ-11:** The dashboard shall display a **summary counter** (e.g., "28/35 Present") at the top of the attendance view.
* **REQ-12:** The teacher shall be able to **filter the attendance view** by class and period using dropdown selectors.

---

#### 3.2.2 UC02 — Generate Engagement Report

##### Description and Priority

**Priority: MEDIUM**

The teacher generates a downloadable engagement report summarizing student behavioral data over a selected time range.

##### Stimulus/Response Sequences

| Step | Actor/Stimulus | System Response |
|---|---|---|
| 1 | Teacher navigates to the Reports section and selects "Engagement Report". | A form is displayed with date range, class, and format options. |
| 2 | Teacher selects parameters and clicks "Generate". | The backend queries engagement_logs, aggregates data, and returns a formatted report. |
| 3 | Report is ready. | The report is displayed on-screen and a "Download PDF" button is provided. |

##### Functional Requirements

* **REQ-13:** The system shall allow teachers to generate **engagement reports** for a selected class and date range.
* **REQ-14:** The report shall include: per-student engagement breakdown (% Attentive, % Distracted, % Drowsy), class-wide averages, and trend graphs over the selected period.
* **REQ-15:** The report shall be available for **on-screen viewing** and as a **downloadable PDF**.

---

#### 3.2.3 UC03 — View Socio-Emotional Heatmap

##### Description and Priority

**Priority: MEDIUM**

A live socio-emotional heatmap representing the real-time engagement state of the classroom, aggregated from the behavioral classifications pushed by the AI Emotion & Risk Engine (UC20–UC21).

##### Stimulus/Response Sequences

| Step | Actor/Stimulus | System Response |
|---|---|---|
| 1 | Teacher navigates to the Engagement section of the dashboard. | The heatmap view loads, subscribing to real-time engagement data via Supabase. |
| 2 | Engagement state updates arrive for multiple students. | Heatmap tiles re-render with updated colors reflecting each student's current state. |
| 3 | Teacher hovers over a student's tile. | A tooltip displays the student's name, current state, confidence score, and last-updated timestamp. |

##### Functional Requirements

* **REQ-16:** The dashboard shall display a **socio-emotional heatmap** representing each student's current engagement state using a tile-based layout.
* **REQ-17:** Heatmap tiles shall be **color-coded**: green (Attentive), orange (Distracted), red (Drowsy), grey (Unknown/No Data).
* **REQ-18:** The heatmap shall update **in real time** via Supabase real-time subscriptions.
* **REQ-19:** Hovering over a heatmap tile shall display a **tooltip** with the student's name, current state, confidence score, and last-updated timestamp.
* **REQ-20:** The dashboard shall display an **aggregate engagement score** (e.g., "72% Attentive") for the entire class.

---

#### 3.2.4 UC04 — View AI-Generated Dashboard

##### Description and Priority

**Priority: MEDIUM**

A unified AI-powered dashboard view that consolidates real-time attendance status, engagement metrics, and risk alerts into a single overview screen for the teacher.

##### Stimulus/Response Sequences

| Step | Actor/Stimulus | System Response |
|---|---|---|
| 1 | Teacher selects "Dashboard" from the sidebar navigation. | The system renders a consolidated view with summary cards, a mini attendance grid, a mini heatmap, and recent alerts. |
| 2 | Real-time data updates arrive. | Summary cards and widgets update dynamically without requiring manual refresh. |

##### Functional Requirements

* **REQ-21:** The system shall provide a **consolidated AI dashboard** showing: attendance summary card, engagement summary card, at-risk student alerts, and class-level trend sparklines.
* **REQ-22:** All dashboard widgets shall update **in real time** via Supabase subscriptions.
* **REQ-23:** The dashboard shall provide **quick-navigation links** to detailed Attendance, Heatmap, and Reports views.

---

#### 3.2.5 UC05 — Monitor Real-Time Student Alerts

##### Description and Priority

**Priority: HIGH**

Teachers receive and view real-time alerts generated by the AI Emotion & Risk Engine when students are flagged as at-risk or showing concerning behavioral patterns (e.g., persistent drowsiness, prolonged disengagement).

##### Stimulus/Response Sequences

| Step | Actor/Stimulus | System Response |
|---|---|---|
| 1 | The AI Risk Engine (UC22) flags a student as at-risk. | A notification badge appears on the Alerts icon in the dashboard. A toast notification is shown to the teacher. |
| 2 | Teacher clicks the Alerts icon. | An alert panel displays all active and recent alerts, sorted by severity and time. |
| 3 | Teacher clicks on a specific alert. | Alert details are shown: student name, alert type, severity, timestamp, and recommended action. |
| 4 | Teacher marks an alert as "Acknowledged". | The alert is moved from active to acknowledged state in the database. |

##### Functional Requirements

* **REQ-24:** The system shall display a **real-time alert notification** (toast and badge) when the AI Emotion & Risk Engine flags a student.
* **REQ-25:** The alert panel shall list all active alerts with: student name, alert type (e.g., "Persistent Drowsiness", "Extended Disengagement"), **severity level** (Low, Medium, High), and timestamp.
* **REQ-26:** Teachers shall be able to **acknowledge** alerts, moving them from the active list to a history log.
* **REQ-27:** Alert data shall be **pushed in real time** via Supabase real-time subscriptions (linked to UC28).

---

#### 3.2.6 UC06 — Override Attendance/Student Status

##### Description and Priority

**Priority: HIGH**

Teachers can manually override AI-generated attendance records and engagement states to correct errors or handle special circumstances (e.g., a late student, an excused absence).

##### Stimulus/Response Sequences

| Step | Actor/Stimulus | System Response |
|---|---|---|
| 1 | Teacher views the attendance grid and notices an incorrect status. | Teacher clicks on the student's cell. |
| 2 | A status dropdown appears. | Teacher selects the correct status (Present, Absent, Late, Excused). |
| 3 | Teacher confirms the override. | The database record is updated. The override is logged with the teacher's user ID, the previous value, the new value, and a timestamp. |

##### Functional Requirements

* **REQ-28:** Teachers shall be able to **manually override** a student's attendance status via the attendance grid interface.
* **REQ-29:** Available override statuses shall include: `Present`, `Absent`, `Late`, and `Excused`.
* **REQ-30:** Every manual override shall be **logged** in an audit trail with: teacher ID, student ID, previous status, new status, and timestamp.
* **REQ-31:** Manual overrides shall take **precedence** over AI-generated statuses. The system shall not automatically revert a manual override.

---

### 3.3 Student Management (UC08–UC10)

#### 3.3.1 UC08 — Enroll New Student

##### Description and Priority

**Priority: HIGH**

System Administrators or Teachers enroll a new student into the system, which includes capturing the student's personal details and their initial 128-d facial embedding during a supervised enrollment session.

##### Stimulus/Response Sequences

| Step | Actor/Stimulus | System Response |
|---|---|---|
| 1 | Admin/Teacher navigates to Student Management and clicks "Enroll New Student". | An enrollment form is displayed with fields for name, class, guardian info, and a live camera preview for embedding capture. |
| 2 | Admin enters student details and positions the student in front of the camera. | The system displays face detection feedback (bounding box on the live preview). |
| 3 | Admin clicks "Capture Embedding". | The system extracts the 128-d facial embedding from the detected face, normalizes it, and stores it in the `students` table. The raw image is discarded immediately from RAM. |
| 4 | Admin clicks "Save". | The complete student record (profile + embedding) is saved to Supabase. A confirmation message is displayed. |

##### Functional Requirements

* **REQ-32:** The system shall provide an **enrollment form** with fields: student name, class assignment, date of birth, guardian name, guardian contact, and guardian email.
* **REQ-33:** During enrollment, the system shall activate the camera and use the face detection model to **guide the user** by displaying a bounding box around the detected face.
* **REQ-34:** The system shall capture and store a **128-d facial embedding** for the enrolled student. The raw image shall be discarded from memory immediately after embedding extraction.
* **REQ-35:** The system shall validate that a **face is detected** before allowing the embedding capture. If no face is detected, an error message shall be shown.
* **REQ-36:** The enrollment record shall only be saved when **documented parental consent** has been confirmed (via a checkbox/acknowledgment field).

---

#### 3.3.2 UC09 — View Student Profile

##### Description and Priority

**Priority: MEDIUM**

Teachers and System Administrators can view a student's profile, including personal details, assigned class, attendance summary, and engagement history.

##### Functional Requirements

* **REQ-37:** The system shall display a **student profile page** containing: name, class, guardian info, enrollment date, attendance summary (total present/absent/late), and recent engagement trends.
* **REQ-38:** The student profile shall **not display** the raw facial embedding vector or any image data.

---

#### 3.3.3 UC10 — Manage/Edit Student Details

##### Description and Priority

**Priority: MEDIUM**

System Administrators can edit student details, update class assignments, re-capture embeddings, or deactivate student records.

##### Functional Requirements

* **REQ-39:** System Administrators shall be able to **edit** a student's personal details (name, class, guardian info).
* **REQ-40:** System Administrators shall be able to **re-capture** a student's facial embedding (e.g., if the student's appearance has changed significantly). The old embedding shall be overwritten.
* **REQ-41:** System Administrators shall be able to **deactivate** a student record. Deactivated students shall not appear in attendance grids or be matched by the AI module. Their historical data shall be retained.

---

### 3.4 System Administration (UC11–UC14)

#### 3.4.1 UC11 — Manage User Accounts

##### Description and Priority

**Priority: HIGH**

System Administrators create, edit, and deactivate user accounts for Teachers, other Admins, and Parents, assigning appropriate roles.

##### Functional Requirements

* **REQ-42:** System Administrators shall be able to **create new user accounts** with fields: name, email, password, and role (Teacher, Admin, Parent).
* **REQ-43:** System Administrators shall be able to **edit** user account details and **change roles**.
* **REQ-44:** System Administrators shall be able to **deactivate** user accounts. Deactivated accounts shall be unable to log in.
* **REQ-45:** For Parent accounts, the system shall support **linking** the parent account to one or more student records.

---

#### 3.4.2 UC12 — Configure System Settings

##### Description and Priority

**Priority: MEDIUM**

System Administrators configure system-wide settings including AI thresholds, notification preferences, class schedules, and edge device registration.

##### Functional Requirements

* **REQ-46:** The system shall provide a **Settings panel** allowing configuration of: similarity threshold for face matching (default: 0.40), confidence threshold for behavioral classification (default: 0.60), data transmission interval (default: 2 seconds), and alert sensitivity levels.
* **REQ-47:** The system shall allow System Administrators to **register and manage edge devices**, including generating and revoking API keys per device.
* **REQ-48:** The system shall allow configuration of **class schedules** (periods, times) to enable accurate per-period attendance tracking.

---

#### 3.4.3 UC13 — View System Logs

##### Description and Priority

**Priority: LOW**

System Administrators can view operational logs for debugging, auditing, and monitoring system health.

##### Functional Requirements

* **REQ-49:** The system shall maintain **system logs** including: API request/response logs, authentication events (login/logout/failures), edge device connection status, and error logs.
* **REQ-50:** System Administrators shall be able to **view and filter** system logs by date range, log level (Info, Warning, Error), and source (Edge, API, Auth).
* **REQ-51:** System logs shall include all **attendance override audit trails** (linked to REQ-30).

---

#### 3.4.4 UC14 — Generate School-Wide Analytics/Reports

##### Description and Priority

**Priority: MEDIUM**

System Administrators generate aggregate analytics reports spanning all classes, teachers, and students across the school.

##### Functional Requirements

* **REQ-52:** The system shall allow System Administrators to generate **school-wide attendance reports** showing: overall attendance rate, per-class breakdown, and chronic absenteeism flags.
* **REQ-53:** The system shall allow System Administrators to generate **school-wide engagement reports** showing: aggregate engagement scores per class, trends over time, and at-risk student counts.
* **REQ-54:** Reports shall be viewable on-screen and downloadable as **PDF**.

---

### 3.5 AI: Attendance Module (UC15–UC19)

> **Actor:** AI System (Subsystem) — automated, non-human.  
> This module runs as the Python edge service on the classroom laptop.

#### 3.5.1 UC15 — Capture Camera Feed & Data

##### Description and Priority

**Priority: HIGH**

The AI subsystem initializes and continuously captures video frames from the classroom webcam.

##### Functional Requirements

* **REQ-55:** The edge service shall capture video frames from the configured camera source (webcam index or video file) using **OpenCV's `cv2.VideoCapture` API**.
* **REQ-56:** The default camera resolution shall be **640x480**. The system shall support resolutions up to **1280x720** via configuration.
* **REQ-57:** The system shall support configurable camera input via **command-line arguments** (`--camera 0` or `--camera path/to/video.mp4`).
* **REQ-58:** The system shall display an optional **debug visualization window** (`cv2.imshow`) with bounding boxes and labels overlaid, toggleable via a `--debug` flag.

---

#### 3.5.2 UC16 — Run Facial Detection/Recognition

##### Description and Priority

**Priority: HIGH**

The AI subsystem uses YOLOv8n to detect person bounding boxes and a face detection sub-model to locate faces within each detected person.

##### Functional Requirements

* **REQ-59:** The system shall utilize a **YOLOv8n (Nano)** model to detect person-class bounding boxes in the camera feed.
* **REQ-60:** The detection pipeline shall achieve a minimum of **10 FPS** on the target CPU hardware (Acer Aspire 3).
* **REQ-61:** The system shall assign a **persistent tracking ID** to each detected person using YOLO's built-in tracker (BoT-SORT or ByteTrack).
* **REQ-62:** The system shall default to `device='cpu'` for all model inference. If a CUDA-compatible GPU is detected, the system shall log a notification and optionally use GPU execution.

---

#### 3.5.3 UC17 — Match Student Facial Embeddings

##### Description and Priority

**Priority: HIGH**

The AI subsystem extracts 128-d facial embeddings from detected faces. These are transmitted to the backend for matching against enrolled student profiles using `pgvector`.

##### Functional Requirements

* **REQ-63:** The system shall extract a **128-dimensional floating-point vector** (embedding) from each detected face using a face-embedding model (e.g., FaceNet, ArcFace, or dlib ResNet).
* **REQ-64:** The embedding extraction shall complete within **100ms per face** on the target CPU hardware.
* **REQ-65:** All embeddings shall be **normalized** to unit length (L2 norm = 1.0) before transmission.
* **REQ-66:** If no face is detected within a person's bounding box, the embedding shall be set to `null`.
* **REQ-67:** **No raw image data** (pixels, crops, thumbnails) shall be saved to disk, cached, or included in the transmitted payload.
* **REQ-68:** The backend shall query the Supabase `pgvector` index using **cosine distance** to find the nearest enrolled student embedding.
* **REQ-69:** The backend shall use a configurable **similarity threshold** (default: cosine distance <= 0.40) to accept or reject a match.

---

#### 3.5.4 UC18 — Mark/Auto-Mark Attendance

##### Description and Priority

**Priority: HIGH**

When a facial embedding match is confirmed, the system automatically creates or updates the student's attendance record for the current date and class period.

##### Functional Requirements

* **REQ-70:** Upon a successful embedding match, the backend shall **upsert** the student's attendance record for the current date and period, setting status to `"Present"` and recording the timestamp.
* **REQ-71:** If a student is matched **multiple times** within the same period, the attendance status shall remain `"Present"` (idempotent) — only the engagement state and last-seen timestamp shall update.
* **REQ-72:** Unmatched embeddings shall be logged as `"Unrecognized"` for System Administrator review.

---

#### 3.5.5 UC19 — Send/Store Attendance Notifications

##### Description and Priority

**Priority: MEDIUM**

After attendance is marked, the system sends notifications to relevant parties (Parents, Teachers) via the dashboard and/or email.

##### Functional Requirements

* **REQ-73:** Upon marking a student as `"Present"`, the system shall **push a real-time event** via Supabase Realtime to update all subscribed dashboard clients.
* **REQ-74:** If a student remains **unmarked (Absent)** after a configurable grace period (default: 15 minutes into the period), the system shall trigger an **absence alert** visible to the Teacher and the linked Parent.
* **REQ-75:** The system shall store all attendance notifications in a **notifications** table for historical reference.

---

### 3.6 AI: Emotion & Risk Engine (UC20–UC23, UC28)

> **Actor:** AI System (Subsystem) — automated, runs on the edge device and backend.

#### 3.6.1 UC20 — Analyze Student Behavior

##### Description and Priority

**Priority: HIGH**

The AI subsystem continuously analyzes each detected student's ROI (Region of Interest) to assess their behavioral state during class.

##### Functional Requirements

* **REQ-76:** For each detected student, the system shall crop the **bounding box ROI** from the current frame and pass it to the behavioral classification model.
* **REQ-77:** Behavioral analysis shall be performed **per-frame** for each tracked individual.
* **REQ-78:** The system shall associate the behavioral analysis result with the individual's **persistent track ID** (from UC16).

---

#### 3.6.2 UC21 — Classify Emotion States

##### Description and Priority

**Priority: HIGH**

The AI subsystem classifies each student's emotional/engagement state using a YOLOv8n-cls model.

##### Functional Requirements

* **REQ-79:** The system shall classify each student's engagement state into one of the following categories: `"Attentive"`, `"Distracted"`, `"Drowsy"`, or `"Unknown"`.
* **REQ-80:** The classification model shall be a **YOLOv8n-cls (Nano classification)** variant.
* **REQ-81:** The system shall only emit a behavioral label when the classification confidence exceeds a configurable threshold (default: **0.60**). Below this threshold, the label shall be `"Unknown"`.

---

#### 3.6.3 UC22 — Detect At-Risk Patterns/Engagement Flags

##### Description and Priority

**Priority: MEDIUM**

The backend analyzes engagement history to detect students exhibiting persistent negative behavioral patterns (e.g., consistently Drowsy or Distracted across multiple class periods) and flags them as at-risk.

##### Functional Requirements

* **REQ-82:** The system shall analyze each student's engagement history and flag students as **"At-Risk"** if they exhibit prolonged or recurring negative states (e.g., Drowsy for > 50% of a class period, or Distracted for > 3 consecutive periods).
* **REQ-83:** At-risk thresholds shall be **configurable** by System Administrators via the Settings panel (UC12).
* **REQ-84:** When a student is flagged as at-risk, the system shall generate an **alert** (linked to UC05 for Teacher notification and UC25 for Parent notification).

---

#### 3.6.4 UC23 — Generate Emotion Analytics Report

##### Description and Priority

**Priority: MEDIUM**

The system generates detailed emotion analytics reports aggregating behavioral classification data over time.

##### Functional Requirements

* **REQ-85:** The system shall generate **emotion analytics reports** containing: per-student emotion state distribution, class-wide engagement trends, at-risk student summary, and comparison across time periods.
* **REQ-86:** Emotion reports shall be accessible from both the Teacher Operations view (UC02) and the System Administration view (UC14).

---

#### 3.6.5 UC28 — Push Real-Time WebSocket Events

##### Description and Priority

**Priority: HIGH**

The backend publishes all state changes (attendance updates, engagement state changes, alerts) as real-time events via Supabase's Realtime WebSocket service to all subscribed clients.

##### Functional Requirements

* **REQ-87:** The backend shall push **real-time events** to subscribed React clients via Supabase Realtime whenever: an attendance record is created/updated, an engagement state changes, or an alert is generated.
* **REQ-88:** The edge service shall transmit JSON payloads to the Express.js backend via **HTTP POST** at a configurable interval (default: every **2 seconds**).
* **REQ-89:** Each JSON payload from the edge service shall conform to the following schema:
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
        "bbox": "[x1, y1, x2, y2] (relative 0.0-1.0)"
      }
    ]
  }
  ```
* **REQ-90:** The edge service shall authenticate each POST request using a **pre-shared API key** in the `Authorization` header.
* **REQ-91:** If the API endpoint is unreachable, the edge service shall **queue payloads locally** (in-memory, up to 100 payloads) and retry with **exponential backoff** (initial delay: 1s, max delay: 30s).

---

### 3.7 Parent Portal (UC24–UC26)

#### 3.7.1 UC24 — View Attendance History

##### Description and Priority

**Priority: MEDIUM**

Parents view their child's attendance history, including per-day and per-period status, with filtering and summary statistics.

##### Stimulus/Response Sequences

| Step | Actor/Stimulus | System Response |
|---|---|---|
| 1 | Parent logs in to the dashboard. | The system identifies the linked student(s) and displays the parent's home view. |
| 2 | Parent selects "Attendance History". | A calendar/table view shows attendance records for their child, with color-coded status per day. |
| 3 | Parent selects a specific date. | Detailed per-period attendance for that day is displayed. |

##### Functional Requirements

* **REQ-92:** Parents shall be able to view their linked child's **attendance history** in a calendar or table format.
* **REQ-93:** The attendance history shall show **per-day status** (color-coded) and allow drill-down to **per-period detail**.
* **REQ-94:** The view shall display **summary statistics**: total days present, absent, late, and excused for the current term.
* **REQ-95:** Parents shall **only** be able to view data for their **own linked child(ren)**, enforced by Supabase Row-Level Security (RLS).

---

#### 3.7.2 UC25 — Receive/View Alerts & Notifications

##### Description and Priority

**Priority: MEDIUM**

Parents receive notifications about their child's attendance (e.g., absence alerts) and at-risk behavioral flags from the Emotion & Risk Engine.

##### Functional Requirements

* **REQ-96:** Parents shall receive **notifications** when: their child is marked absent (after the grace period), or their child is flagged as at-risk by the Emotion & Risk Engine.
* **REQ-97:** Notifications shall be displayed in a **notification center** within the Parent Portal dashboard.
* **REQ-98:** Parents shall be able to view **notification history** with date, type, and message details.

---

#### 3.7.3 UC26 — View Student Progress/Report

##### Description and Priority

**Priority: LOW**

Parents view a summary report of their child's engagement and behavioral trends over time.

##### Functional Requirements

* **REQ-99:** Parents shall be able to view a **student progress report** showing: attendance rate trend, engagement score trend, and any active or resolved at-risk flags.
* **REQ-100:** The progress report shall present data in **chart/graph format** (line charts for trends, pie charts for engagement breakdown) for easy comprehension.

---

## 4. External Interface Requirements

### 4.1 User Interfaces

#### 4.1.1 React Dashboard — Teacher View

* **Layout:** Single-page application with a collapsible sidebar navigation and a main content area.
* **Attendance Grid (UC01):** Responsive grid of student cards with color-coded status indicators.
* **Engagement Heatmap (UC03):** Tile-based seating-chart visualization with color gradients.
* **AI Dashboard (UC04):** Consolidated view with summary cards, mini-grid, mini-heatmap, and alert feed.
* **Alert Panel (UC05):** Slide-out panel with alert list, severity indicators, and acknowledge buttons.
* **Navigation:** Sidebar links to: Dashboard, Attendance, Engagement, Reports, Students, Settings.
* **Responsive Design:** Usable on screens from 1024px width (laptop) upward.
* **Accessibility:** Color-coded elements shall include text labels or icons for color vision deficiency support.

#### 4.1.2 React Dashboard — Parent View

* **Layout:** Simplified dashboard with child-focused navigation.
* **Attendance History (UC24):** Calendar view with color-coded day cells and drill-down to period detail.
* **Notifications (UC25):** Notification bell icon with badge count and expandable notification list.
* **Progress Report (UC26):** Charts and graphs showing attendance and engagement trends.
* **Responsive Design:** Optimized for mobile browsers (viewport >= 375px) since parents may primarily use phones.

#### 4.1.3 React Dashboard — Admin View

* **Layout:** Extended teacher view with additional admin-only sections.
* **User Management (UC11):** Table of users with create/edit/deactivate actions.
* **System Settings (UC12):** Forms for threshold configuration, device management, and schedule setup.
* **System Logs (UC13):** Filterable log viewer with search and date range controls.
* **School Analytics (UC14):** School-wide report dashboards with charts and export options.

#### 4.1.4 Edge Script CLI

* Operated via **Windows PowerShell** or **Command Prompt**.
* Console output: initialization status, FPS counter, detection count per frame, and transmission status.
* Optional **debug visualization window** (`cv2.imshow`) with bounding boxes, track IDs, and state labels, toggleable via `--debug` flag.

### 4.2 Hardware Interfaces

| Interface | Description |
|---|---|
| **Camera** | OpenCV `cv2.VideoCapture` API on Windows. Supported: USB webcams, integrated laptop cameras. Resolutions: 640x480 (default) to 1280x720. |
| **CPU/GPU** | Inference on CPU via PyTorch CPU backend. Optional CUDA GPU if NVIDIA hardware is detected. |

### 4.3 Software Interfaces

| Interface | Components | Data Exchanged | Protocol |
|---|---|---|---|
| **Edge to Express API** | Python (client) to Express.js (server) | JSON payload (see REQ-89 schema) | HTTPS POST |
| **Express to Supabase** | Express.js (client) to Supabase PostgreSQL | SQL queries (pgvector similarity), CRUD operations | Supabase JS Client Library |
| **Supabase to React** | Supabase Realtime to React apps | Real-time DB change events (INSERT, UPDATE) | WebSocket (Supabase Realtime) |
| **Supabase Auth** | React apps to Supabase Auth | Credentials, JWTs, session tokens | HTTPS (Supabase Auth API) |

### 4.4 Communications Interfaces

* **HTTP/HTTPS (REST):** Edge-to-API communication uses HTTPS with TLS 1.2+ in production. HTTP permitted in local development.
* **WebSocket:** Supabase Realtime service delivers real-time events to all React clients.
* **Data Format:** All payloads JSON-encoded, UTF-8 character encoding.
* **Message Size:** Typical payload (40 detections) is approximately 25-30 KB. Maximum supported: 100 KB.
* **Transfer Rate:** At 2-second intervals, average upload bandwidth required is approximately 12-15 KB/s.

---

## 5. Other Nonfunctional Requirements

### 5.1 Performance Requirements

| ID | Requirement | Target | Rationale |
|---|---|---|---|
| **NFR-01** | Edge inference framerate | >= **10 FPS** on Acer Aspire 3 CPU | Minimum viable speed for tracking and identity persistence. |
| **NFR-02** | Embedding extraction latency | <= **100ms per face** on CPU | Must not bottleneck overall FPS. |
| **NFR-03** | End-to-end latency (capture to dashboard) | <= **3 seconds** | Near-real-time teacher feedback. |
| **NFR-04** | API response time (pgvector query) | <= **500ms** per payload (up to 40 embeddings) | Prevents backend queue buildup. |
| **NFR-05** | Dashboard real-time update | <= **1 second** from DB write to UI render | Supabase Realtime typically 200-500ms. |
| **NFR-06** | Concurrent dashboard users | >= **20 simultaneous** sessions (teachers + parents + admins) | Full school concurrent use. |
| **NFR-07** | Maximum students per classroom | >= **40 students** detected simultaneously | Upper bound for Malaysian primary school classrooms. |

### 5.2 Safety Requirements

| ID | Requirement | Description |
|---|---|---|
| **NFR-08** | **Child Safety** | All data handling must adhere to **data minimization** — collect and store only the absolute minimum (128-d vectors and text labels). |
| **NFR-09** | **No Identifiable Media** | Under no circumstance shall the system produce, store, or transmit photo/video content that could identify a minor. Violation is a **critical system failure**. |
| **NFR-10** | **Fail-Safe Behavior** | On unrecoverable error, the edge script shall **terminate gracefully**, release the camera, and ensure no temporary image files remain on disk. |
| **NFR-11** | **Teacher Override** | The system shall always allow teachers to manually override AI-generated data, ensuring the human remains the final authority (see REQ-28-31). |

### 5.3 Security Requirements

| ID | Requirement | Description |
|---|---|---|
| **NFR-12** | **User Authentication** | All users must authenticate via **Supabase Auth** before accessing the dashboard (see UC00). |
| **NFR-13** | **API Authentication** | The Express.js API shall validate a **pre-shared API key** on every edge device request. Invalid keys result in `401 Unauthorized`. |
| **NFR-14** | **HTTPS Enforcement** | All production communications shall use **HTTPS (TLS 1.2+)**. |
| **NFR-15** | **Row-Level Security** | Supabase RLS policies shall ensure: Teachers see only their classes, Parents see only their children. |
| **NFR-16** | **JWT Validation** | The Express.js backend shall validate Supabase JWTs on all frontend API requests. |
| **NFR-17** | **Secret Management** | API keys, connection strings, and service keys stored in `.env` files, never hardcoded. |

### 5.4 Privacy Requirements

| ID | Requirement | Description |
|---|---|---|
| **NFR-18** | **No Raw Image Persistence** | Raw pixel data exists **only in volatile memory (RAM)** during inference. Never written to disk, cached, or transmitted. |
| **NFR-19** | **Embedding Irreversibility** | 128-d embeddings **cannot be reverse-engineered** into facial images. This shall be documented for stakeholders. |
| **NFR-20** | **Data Retention** | Records retained for the **current academic year**. Data older than 12 months archived/purged per school policy. |
| **NFR-21** | **Parental Consent** | Student enrollment requires **documented parental/guardian consent**. Consent management is a prerequisite outside software scope. |

### 5.5 Software Quality Attributes

| Quality Attribute | Requirement | Metric |
|---|---|---|
| **Portability** | Python edge code uses **OS-agnostic libraries** (OpenCV, PyTorch, Ultralytics). | Runs on macOS/Linux with <= 1 hour config changes. |
| **Robustness** | Edge script **auto-reconnects** to API on network drop. | Reconnection within 30 seconds. |
| **Usability** | Dashboard intuitive for non-technical teachers **without training** beyond Quick-Start Guide. | New user completes core tasks within 2 minutes. |
| **Maintainability** | Code follows PEP 8 (Python), ESLint/Prettier (JS). Loosely coupled modules. | Code review compliance >= 90%. |
| **Testability** | All 100 functional requirements have **corresponding test cases**. | 100% REQ-to-test coverage. |
| **Reliability** | Edge script operates **continuously for 8 hours** (full school day). | Zero unhandled exceptions in soak test. |

---

## 6. Other Requirements

### 6.1 Database Requirements

* **PostgreSQL Version:** Supabase instance shall run PostgreSQL 15+ with `pgvector` extension.
* **Embedding Index:** `vector(128)` column indexed with **IVFFlat** or **HNSW** for efficient nearest-neighbor queries.
* **Schema Overview:**

| Table | Key Columns | Purpose |
|---|---|---|
| `users` | `id` (Supabase Auth UID), `role`, `display_name`, `email` | All system users (Teachers, Admins, Parents). |
| `students` | `id`, `name`, `class_id`, `dob`, `guardian_name`, `guardian_email`, `embedding vector(128)`, `is_active` | Enrolled student profiles with face embeddings. |
| `classes` | `id`, `name`, `teacher_id`, `schedule_json` | Class/section definitions with period schedules. |
| `attendance` | `id`, `student_id`, `class_id`, `date`, `period`, `status`, `first_seen_at`, `override_by`, `override_at` | Daily attendance records with override audit trail. |
| `engagement_logs` | `id`, `student_id`, `class_id`, `state`, `confidence`, `timestamp` | Per-interval engagement state records. |
| `alerts` | `id`, `student_id`, `type`, `severity`, `message`, `is_acknowledged`, `acknowledged_by`, `created_at` | AI-generated at-risk and absence alerts. |
| `notifications` | `id`, `user_id`, `alert_id`, `type`, `message`, `is_read`, `created_at` | Notifications dispatched to Teachers and Parents. |
| `devices` | `id`, `classroom_id`, `api_key_hash`, `last_seen`, `is_active` | Registered edge devices. |
| `audit_logs` | `id`, `user_id`, `action`, `entity_type`, `entity_id`, `old_value`, `new_value`, `timestamp` | System-wide audit trail. |
| `parent_student_link` | `parent_user_id`, `student_id` | Links Parent accounts to their children. |

### 6.2 Internationalization Requirements

* The React dashboard shall initially support **English (en)** as the primary language.
* UI text shall be organized in a **localization-ready structure** (e.g., i18n JSON files) to facilitate future translation into **Bahasa Malaysia (ms)**.

### 6.3 Legal and Compliance

* The system shall comply with Malaysia's **Personal Data Protection Act 2010 (PDPA)** regarding the processing of personal data (128-d embeddings) of minors.
* Parental consent documentation is a prerequisite for enrollment (linked to REQ-36).

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| **PRISM-AI** | Primary School Intelligent Student Management and Predictive Analytics Ecosystem. |
| **Edge Device** | The classroom laptop (Acer Aspire 3) running the Python inference script locally. |
| **YOLO** | "You Only Look Once" — a family of real-time object detection models. |
| **YOLOv8n** | The "Nano" variant of YOLOv8, optimized for speed on resource-constrained hardware. |
| **YOLOv8n-cls** | The Nano classification variant of YOLOv8, used for behavioral/engagement state classification. |
| **ROI** | Region of Interest — the bounding box area in an image frame where a student has been detected. |
| **128-d Embedding** | A 128-dimensional floating-point vector representing unique facial features, irreversible to the original image. |
| **pgvector** | A PostgreSQL extension for storing, indexing, and querying vector embeddings efficiently. |
| **Cosine Distance** | A distance metric measuring the angular difference between two vectors; used for embedding similarity matching. |
| **Supabase** | An open-source Backend-as-a-Service platform built on PostgreSQL, providing Auth, Realtime, and DB hosting. |
| **JWT** | JSON Web Token — a compact, URL-safe token format for authentication and authorization. |
| **RLS** | Row-Level Security — PostgreSQL feature restricting row access based on policies. |
| **SPA** | Single Page Application — a web app that dynamically rewrites the page without full reloads. |
| **RAD** | Rapid Application Development — agile methodology emphasizing quick prototyping. |
| **FPS** | Frames Per Second — video frames processed per second by the inference pipeline. |
| **BoT-SORT / ByteTrack** | Multi-object tracking algorithms for persistent ID assignment across frames. |
| **Education 5.0** | A paradigm integrating AI, IoT, and human-centric technology in education. |
| **SDG 4.1** | UN Sustainable Development Goal 4, Target 4.1: quality primary education for all. |
| **PDPA** | Personal Data Protection Act 2010 — Malaysia's data protection legislation. |
| **At-Risk Flag** | A system-generated indicator that a student is exhibiting persistent negative behavioral patterns. |
| **Grace Period** | A configurable time window after class begins before absence alerts are triggered. |

---

## Appendix B: Analysis Models

### B.1 Use Case Diagram

The PRISM-AI Use Case Diagram (Reference R2) illustrates the complete functional scope of the system by defining the interactions between **four actors** and **28 use cases**, organized into **seven functional groups** within the PRISM-AI system boundary.

#### B.1.1 Actors

The system identifies four distinct actors:

| Actor | Type | Description |
|---|---|---|
| **Teacher** | Primary (Human) | The main user of the system. Interacts with the web dashboard daily to monitor attendance, view engagement data, receive at-risk alerts, manage student records, and manually override AI-generated statuses. |
| **System Administrator** | Secondary (Human) | Responsible for system setup and maintenance. Manages user accounts, configures system settings and AI thresholds, views system logs, generates school-wide reports, and handles student enrollment and record management. |
| **Parent** | Secondary (Human) | Accesses a dedicated Parent Portal to view their child's attendance history, receive absence and at-risk notifications, and view student progress reports. |
| **AI System (Subsystem)** | Internal (Non-Human) | An automated software agent representing the edge AI pipeline. Operates autonomously to capture camera feeds, run facial detection, extract and match embeddings, classify emotional states, detect at-risk patterns, and push real-time events to the dashboard via WebSocket. |

#### B.1.2 Functional Groups and Use Cases

The 28 use cases are organized into seven logical groups:

**1. Authentication (UC00)**

* **UC00 — Login/Logout:** Provides secure authentication for all human actors (Teacher, System Administrator, Parent) via Supabase Auth. This use case has an `<<include>>` relationship with all other user-facing use cases, meaning every interaction with the web dashboard requires the user to be authenticated first.

**2. Teacher Operations (UC01–UC06)**

This group contains the core daily functions available to teachers through the web dashboard:

* **UC01 — View Real-Time Attendance Grid:** Displays a live-updating grid showing each student's attendance status (Present, Absent, Late, Excused) for the current class period. Data is pushed in real time via WebSocket.
* **UC02 — Generate Engagement Report:** Allows the teacher to generate a downloadable report summarizing student engagement data over a selected date range.
* **UC03 — View Socio-Emotional Heatmap:** Displays a tile-based visualization where each student is color-coded based on their current engagement state (Attentive, Distracted, Drowsy).
* **UC04 — View AI-Generated Dashboard:** A consolidated overview screen combining attendance summaries, engagement metrics, and recent alerts into a single view.
* **UC05 — Monitor Real-Time Student Alerts:** Teachers receive and view real-time notifications when the AI Emotion & Risk Engine flags a student as at-risk due to concerning behavioral patterns.
* **UC06 — Override Attendance/Student Status:** Allows teachers to manually correct or override AI-generated attendance records (e.g., marking a student as "Late" or "Excused"), ensuring the human teacher always has final authority over the data.

**3. Student Management (UC08–UC10)**

Shared between both the Teacher and System Administrator actors:

* **UC08 — Enroll New Student:** Registers a new student into the system, capturing their personal details and their initial 128-dimensional facial embedding during a supervised enrollment session. The raw image is discarded immediately after embedding extraction.
* **UC09 — View Student Profile:** Displays a student's profile page including personal details, attendance summary, and engagement trends.
* **UC10 — Manage/Edit Student Details:** Allows editing of student information, re-capturing of facial embeddings, and deactivation of student records.

**4. System Administration (UC11–UC14)**

Exclusive to the System Administrator actor:

* **UC11 — Manage User Accounts:** Create, edit, and deactivate user accounts for Teachers, Admins, and Parents, with appropriate role assignment.
* **UC12 — Configure System Settings:** Configure AI thresholds (face matching similarity, classification confidence), notification preferences, class schedules, and edge device registration.
* **UC13 — View System Logs:** Access operational logs for debugging, auditing, and monitoring, including API request logs, authentication events, and override audit trails.
* **UC14 — Generate School-Wide Analytics/Reports:** Generate aggregate reports spanning all classes and students, including school-wide attendance rates, engagement scores, and chronic absenteeism flags.

**5. AI: Attendance Module (UC15–UC19)**

This group represents the automated AI pipeline for facial recognition and attendance marking. These use cases are performed by the AI System subsystem and have sequential `<<include>>` relationships forming a processing chain:

* **UC15 — Capture Camera Feed & Data:** The edge service initializes the webcam and continuously captures video frames. UC15 `<<includes>>` UC16.
* **UC16 — Run Facial Detection/Recognition:** YOLOv8n detects person-class bounding boxes in each frame and assigns persistent tracking IDs using BoT-SORT or ByteTrack. UC16 `<<includes>>` UC17.
* **UC17 — Match Student Facial Embeddings:** The system extracts a 128-dimensional facial embedding from each detected face and transmits it to the backend, where Supabase pgvector performs cosine distance matching against enrolled students. UC17 `<<includes>>` UC18.
* **UC18 — Mark/Auto-Mark Attendance:** When a successful embedding match is found (within the similarity threshold), the student's attendance record is automatically created or updated to "Present". UC18 `<<includes>>` UC19.
* **UC19 — Send/Store Attendance Notification:** After attendance is marked, the system pushes real-time events to the dashboard and triggers absence alerts if students remain unmarked after a grace period.

**6. AI: Emotion & Risk Engine (UC20–UC23, UC28)**

This group represents the behavioral analysis and at-risk detection pipeline:

* **UC20 — Analyze Student Behavior:** For each detected student, the system crops the bounding box ROI and passes it to the behavioral analysis model. UC16 `<<includes>>` UC20 (behavior analysis runs in parallel with embedding extraction).
* **UC21 — Classify Emotion States:** A YOLOv8n-cls classification model categorizes each student's engagement state as "Attentive", "Distracted", "Drowsy", or "Unknown". UC20 `<<includes>>` UC21.
* **UC22 — Detect At-Risk Patterns/Engagement Flags:** The backend analyzes engagement history over time and flags students exhibiting persistent negative behavioral patterns (e.g., consistently drowsy across multiple periods). UC21 `<<extends>>` UC22 (at-risk detection is triggered only when patterns meet configured thresholds).
* **UC23 — Generate Emotion Analytics Report:** The system aggregates behavioral classification data into structured reports showing per-student emotion distribution, class-wide trends, and at-risk summaries.
* **UC28 — Push Real-Time WebSocket Events:** The backend publishes all state changes (attendance updates, engagement changes, and alerts) via Supabase Realtime WebSocket to all subscribed dashboard clients, enabling real-time UI updates without page refresh.

**7. Parent Portal (UC24–UC26)**

Exclusive to the Parent actor:

* **UC24 — View Attendance History:** Parents view their child's attendance records in a calendar or table format, with per-day color-coded status and drill-down to individual periods.
* **UC25 — Receive/View Alerts & Notifications:** Parents receive notifications when their child is marked absent or flagged as at-risk by the Emotion & Risk Engine.
* **UC26 — View Student Progress/Report:** Parents view summary reports showing their child's attendance rate trends, engagement score trends, and any active or resolved at-risk flags.

#### B.1.3 Key Relationships

The diagram utilizes two types of UML relationships:

* **`<<include>>`** — Indicates a mandatory dependency. For example, UC00 (Login/Logout) is included by all user-facing use cases, and the AI Attendance Module use cases form a sequential processing chain (UC15 → UC16 → UC17 → UC18 → UC19).
* **`<<extend>>`** — Indicates optional or conditional behavior. For example, UC22 (Detect At-Risk Patterns) extends UC21 (Classify Emotion States), meaning at-risk detection only triggers when certain conditions are met.

#### B.1.4 Actor–Use Case Access Summary

| Actor | Accessible Use Cases |
|---|---|
| **Teacher** | UC00, UC01–UC06, UC08–UC10 |
| **System Administrator** | UC00, UC08–UC14 |
| **Parent** | UC00, UC24–UC26 |
| **AI System (Subsystem)** | UC15–UC23, UC28 |

### B.2 System Architecture Diagram

*(Refer to the Context Diagram in Section 2.1.)*

### B.3 Data Flow Diagram (Level 0)

```
┌──────────┐                                          ┌─────────────┐
│  Webcam   │──── Video Frames ───> [P1: YOLO         │             │
│  (Camera) │                       Detection &       │  Express.js │
└──────────┘                       Classification]    │  API Server │
                                        |             │             │
                                        | JSON        └──────┬──────┘
                                        | Payload            │
                                        v                    │ SQL/pgvector
                                  [P2: Embedding       ┌─────v──────┐
                                   Extraction &        │  Supabase   │
                                   Transmission] ────> │  PostgreSQL │
                                                       │  + pgvector │
                                                       └──────┬──────┘
                                                              │
                                                              │ Realtime
                                                              │ (WebSocket)
                                                              v
                                                ┌────────────────────────┐
                                                │    React.js Clients    │
                                                │  • Teacher Dashboard   │
                                                │  • Admin Dashboard     │
                                                │  • Parent Portal       │
                                                └────────────────────────┘
```

### B.4 Data Flow Diagram (Level 1 — Edge Process Detail)

```
Camera Frame
     |
     v
[1.1 YOLOv8n Person Detection] (UC16)
     |
     |--- Bounding Boxes ----> [1.2 BoT-SORT Tracking] (UC16) --> Track IDs
     |                                                                |
     |--- ROI Crops ----------> [1.3 YOLOv8n-cls Behavioral         |
     |                                Classification] (UC20/UC21) --> State Labels
     |                                                                |
     |--- Face Crops ---------> [1.4 Face Embedding                  |
                                      Extraction] (UC17) --> 128-d Vectors
                                                                     |
                                                          ┌──────────v──────────┐
                                                          │  [1.5 JSON Payload  │
                                                          │   Assembly & POST]  │
                                                          │   (UC18/UC28)       │
                                                          └─────────────────────┘
```

### B.5 Entity-Relationship Diagram

```
┌──────────┐       ┌──────────────┐       ┌────────────────┐
│  users   │       │   classes    │       │   students     │
│──────────│       │──────────────│       │────────────────│
│ id (PK)  │──┐    │ id (PK)      │──┐    │ id (PK)        │
│ role     │  └──> │ teacher_id(FK│  │    │ name           │
│ name     │       │ name         │  └──> │ class_id (FK)  │
│ email    │       │ schedule     │       │ embedding(128) │
└─────┬────┘       └──────┬───────┘       │ is_active      │
      │                   │               └──┬──────┬──────┘
      │                   │                  │      │
      │            ┌──────v───────┐   ┌──────v──────v───────┐
      │            │  attendance  │   │  engagement_logs    │
      │            │──────────────│   │─────────────────────│
      │            │ student_id   │   │ student_id (FK)     │
      │            │ class_id(FK) │   │ class_id (FK)       │
      │            │ date, period │   │ state, confidence   │
      │            │ status       │   │ timestamp           │
      │            │ override_by  │   └─────────────────────┘
      │            └──────────────┘
      │
      │    ┌──────────────────────┐    ┌─────────────────────┐
      │    │      alerts          │    │   notifications     │
      │    │──────────────────────│    │─────────────────────│
      │    │ student_id (FK)      │    │ user_id (FK)        │
      └──> │ type, severity       │──> │ alert_id (FK)       │
           │ is_acknowledged      │    │ type, message       │
           │ acknowledged_by (FK) │    │ is_read             │
           └──────────────────────┘    └─────────────────────┘

┌────────────────────┐
│ parent_student_link│
│────────────────────│
│ parent_user_id(FK) │
│ student_id (FK)    │
└────────────────────┘
```

---

## Appendix C: Issues List

| ID | Issue | Status | Priority | Notes |
|---|---|---|---|---|
| ISS-1 | **Engagement classification dataset.** Which dataset for YOLOv8n-cls fine-tuning? Options: DAiSEE, custom, hybrid. | **Open** | High | Impacts REQ-79, REQ-80 accuracy. |
| ISS-2 | **Face embedding model selection.** dlib ResNet vs FaceNet vs ArcFace — evaluate CPU speed vs accuracy. | **Open** | High | Impacts REQ-63, REQ-64 performance. |
| ISS-3 | **Similarity threshold calibration.** Default 0.40 cosine distance needs empirical validation. | **Open** | Medium | Too low = false rejections; too high = false matches. |
| ISS-4 | **Student enrollment UX.** Design the enrollment UI/script for embedding capture (UC08). | **Open** | High | Prerequisite for UC17 matching. |
| ISS-5 | **Multi-camera support.** v1.0 assumes single camera per classroom. Schema should be forward-compatible. | **Deferred (v2.0)** | Low | Schema in S6.1 already includes `devices` table. |
| ISS-6 | **Extended offline mode.** REQ-91 handles short-term queueing. Full offline-to-sync for extended outages? | **Open** | Medium | Critical for schools with unstable internet. |
| ISS-7 | **PDPA compliance review.** Formal legal review of 128-d embedding storage under PDPA. | **Open** | High | Legal requirement (S6.3). |
| ISS-8 | **Supabase plan limits.** Confirm Free vs Pro tier supports required real-time connections + pgvector. | **Open** | Medium | Dependency A3. |
| ISS-9 | **Parent notification delivery.** Should parents receive email notifications in addition to in-app? Email service (e.g., Resend, SendGrid) selection needed. | **Open** | Medium | Impacts UC25 implementation. |
| ISS-10 | **At-risk pattern thresholds.** Define concrete defaults for REQ-82 (e.g., Drowsy > 50% of period). Needs educator input. | **Open** | Medium | Requires consultation with school staff. |

---

## Requirements Traceability Matrix

| Use Case | REQ IDs | Priority |
|---|---|---|
| UC00: Login/Logout | REQ-01 to REQ-07 | High |
| UC01: View Real-Time Attendance Grid | REQ-08 to REQ-12 | High |
| UC02: Generate Engagement Report | REQ-13 to REQ-15 | Medium |
| UC03: View Socio-Emotional Heatmap | REQ-16 to REQ-20 | Medium |
| UC04: View AI-Generated Dashboard | REQ-21 to REQ-23 | Medium |
| UC05: Monitor Real-Time Student Alerts | REQ-24 to REQ-27 | High |
| UC06: Override Attendance/Student Status | REQ-28 to REQ-31 | High |
| UC08: Enroll New Student | REQ-32 to REQ-36 | High |
| UC09: View Student Profile | REQ-37 to REQ-38 | Medium |
| UC10: Manage/Edit Student Details | REQ-39 to REQ-41 | Medium |
| UC11: Manage User Accounts | REQ-42 to REQ-45 | High |
| UC12: Configure System Settings | REQ-46 to REQ-48 | Medium |
| UC13: View System Logs | REQ-49 to REQ-51 | Low |
| UC14: Generate School-Wide Reports | REQ-52 to REQ-54 | Medium |
| UC15: Capture Camera Feed | REQ-55 to REQ-58 | High |
| UC16: Run Facial Detection | REQ-59 to REQ-62 | High |
| UC17: Match Facial Embeddings | REQ-63 to REQ-69 | High |
| UC18: Mark/Auto-Mark Attendance | REQ-70 to REQ-72 | High |
| UC19: Send Attendance Notifications | REQ-73 to REQ-75 | Medium |
| UC20: Analyze Student Behavior | REQ-76 to REQ-78 | High |
| UC21: Classify Emotion States | REQ-79 to REQ-81 | High |
| UC22: Detect At-Risk Patterns | REQ-82 to REQ-84 | Medium |
| UC23: Generate Emotion Analytics Report | REQ-85 to REQ-86 | Medium |
| UC24: View Attendance History (Parent) | REQ-92 to REQ-95 | Medium |
| UC25: Receive/View Alerts (Parent) | REQ-96 to REQ-98 | Medium |
| UC26: View Student Progress (Parent) | REQ-99 to REQ-100 | Low |
| UC28: Push Real-Time WebSocket Events | REQ-87 to REQ-91 | High |

---

*— End of Document —*
