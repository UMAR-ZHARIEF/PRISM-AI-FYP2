"""
PRISM-AI Edge Service — Student Enrollment Tool
Captures facial embeddings from a webcam for student registration.
Uses InsightFace (SCRFD + ArcFace) for face detection and 512-d embedding extraction.

Usage:
    python enroll_student.py --name "Ahmad bin Ali" --class "3A" --camera 0
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import cv2
import numpy as np

import gpu_check

# ── InsightFace Setup ─────────────────────────────────────────────────────────

def init_face_app(det_size=(640, 640)):
    """Initialize InsightFace FaceAnalysis on a GPU execution provider."""
    from insightface.app import FaceAnalysis

    # Same no-CPU-fallback gate as face_recognition.py — refuses (exit 3)
    # before the camera is ever opened.
    providers = gpu_check.require_gpu_providers()
    det_size = gpu_check.effective_det_size(providers, det_size)

    print("[INIT] Loading InsightFace models (SCRFD + ArcFace)...")
    print("[INIT] This may take a moment on first run (downloading models)...")

    app = FaceAnalysis(
        name="buffalo_l",
        providers=providers,
        # Enrollment also only needs bbox/kps/det_score/embedding — match
        # face_recognition.py and skip the genderage/landmark models.
        allowed_modules=["detection", "recognition"],
    )
    app.prepare(ctx_id=0, det_size=det_size)

    active = gpu_check.verify_gpu_active(app)
    print(f"[INIT] GPU inference active: {', '.join(sorted(active))}")
    print(f"[INIT] Models loaded successfully. Detection size: {det_size}")
    return app


# ── Database (Local JSON) ────────────────────────────────────────────────────

DB_PATH = Path(__file__).parent / "enrolled_students.json"


def load_database():
    """Load enrolled students from local JSON file."""
    if DB_PATH.exists():
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"students": []}


def save_database(db):
    """Save enrolled students to local JSON file."""
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)


def add_student(db, name, class_name, embedding):
    """Add a new student to the database."""
    student_id = len(db["students"]) + 1
    
    student = {
        "id": student_id,
        "name": name,
        "class": class_name,
        "embedding": embedding.tolist(),  # Convert numpy array to list for JSON
        "enrolled_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    
    db["students"].append(student)
    save_database(db)
    return student_id


# ── Enrollment Logic ─────────────────────────────────────────────────────────

def capture_embeddings(app, camera_index=0, num_captures=5, delay_between=1.0):
    """
    Capture multiple face embeddings from the webcam.
    Returns the averaged embedding for robustness.
    
    Args:
        app: InsightFace FaceAnalysis instance
        camera_index: Camera device index
        num_captures: Number of embeddings to capture and average
        delay_between: Seconds between captures
    
    Returns:
        numpy.ndarray: Averaged 512-d embedding, or None if failed
    """
    # Use DirectShow backend explicitly; let camera pick its native resolution
    # (forcing 1280x720 breaks low-res cameras like UGREEN's default 640x480)
    cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)

    if not cap.isOpened():
        print(f"[ERROR] Cannot open camera {camera_index}")
        return None
    
    embeddings = []
    capture_count = 0
    
    print(f"\n{'='*60}")
    print(f"  PRISM-AI Student Enrollment — Face Capture")
    print(f"  Capturing {num_captures} embeddings. Look at the camera.")
    print(f"  Press 'c' to capture | 'q' to quit")
    print(f"{'='*60}\n")
    
    while capture_count < num_captures:
        ret, frame = cap.read()
        if not ret:
            print("[ERROR] Failed to read frame from camera")
            break
        
        # Run face detection
        faces = app.get(frame)
        
        # Draw UI overlay
        display = frame.copy()
        status_text = f"Captures: {capture_count}/{num_captures}"
        cv2.putText(display, status_text, (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        
        if len(faces) == 0:
            cv2.putText(display, "No face detected - move closer", (10, 70),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        elif len(faces) > 1:
            cv2.putText(display, "Multiple faces - only 1 person please", (10, 70),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 165, 255), 2)
            # Draw all detected faces
            for face in faces:
                bbox = face.bbox.astype(int)
                cv2.rectangle(display, (bbox[0], bbox[1]), (bbox[2], bbox[3]), 
                              (0, 165, 255), 2)
        else:
            # Exactly one face detected
            face = faces[0]
            bbox = face.bbox.astype(int)
            det_score = face.det_score
            
            # Draw bounding box (green = good)
            color = (0, 255, 0) if det_score > 0.5 else (0, 255, 255)
            cv2.rectangle(display, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 2)
            
            # Draw confidence
            conf_text = f"Confidence: {det_score:.2f}"
            cv2.putText(display, conf_text, (bbox[0], bbox[1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
            
            # Draw face landmarks
            if face.kps is not None:
                for kp in face.kps:
                    cv2.circle(display, (int(kp[0]), int(kp[1])), 3, (255, 0, 0), -1)
            
            cv2.putText(display, "Press 'c' to capture this face", (10, 70),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        cv2.imshow("PRISM-AI Enrollment", display)
        key = cv2.waitKey(1) & 0xFF
        
        if key == ord('q'):
            print("[INFO] Enrollment cancelled by user.")
            break
        
        if key == ord('c') and len(faces) == 1:
            face = faces[0]
            
            if face.det_score < 0.5:
                print(f"[WARN] Detection confidence too low ({face.det_score:.2f}). Try again.")
                continue
            
            embedding = face.embedding  # 512-d vector
            embeddings.append(embedding)
            capture_count += 1
            
            # Face size info
            bbox = face.bbox.astype(int)
            face_w = bbox[2] - bbox[0]
            face_h = bbox[3] - bbox[1]
            
            print(f"  [OK] Capture {capture_count}/{num_captures} | "
                  f"Confidence: {face.det_score:.3f} | "
                  f"Face size: {face_w}x{face_h} | "
                  f"Embedding dim: {embedding.shape[0]}")
            
            # Brief pause for user to change angle
            if capture_count < num_captures:
                print(f"  --> Slightly turn your head for the next capture...")
                time.sleep(delay_between)
    
    cap.release()
    cv2.destroyAllWindows()
    
    if len(embeddings) == 0:
        print("[ERROR] No embeddings captured.")
        return None
    
    # Average all captured embeddings for robustness
    avg_embedding = np.mean(embeddings, axis=0)
    
    # Normalize to unit length (L2 norm = 1.0)
    norm = np.linalg.norm(avg_embedding)
    if norm > 0:
        avg_embedding = avg_embedding / norm
    
    print(f"\n[OK] Averaged {len(embeddings)} embeddings -> final 512-d vector (L2-normalized)")
    
    # ── PRIVACY: No raw images saved ──
    # The frame data only exists in RAM during this function.
    # Only the 512-d mathematical vector is retained.
    
    return avg_embedding


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="PRISM-AI Student Enrollment — Capture face embeddings"
    )
    parser.add_argument("--name", required=True, help="Student full name")
    parser.add_argument("--class", dest="class_name", required=True, 
                        help="Class assignment (e.g., '3A')")
    parser.add_argument("--camera", type=int, default=0, 
                        help="Camera device index (default: 0)")
    parser.add_argument("--captures", type=int, default=5,
                        help="Number of face captures to average (default: 5)")
    parser.add_argument("--det-size", type=int, default=640,
                        help="Detection input size (default: 640)")
    
    args = parser.parse_args()
    
    # Initialize InsightFace
    app = init_face_app(det_size=(args.det_size, args.det_size))
    
    # Capture embeddings
    embedding = capture_embeddings(
        app,
        camera_index=args.camera,
        num_captures=args.captures,
    )
    
    if embedding is None:
        print("\n[FAILED] Enrollment failed. No embedding captured.")
        sys.exit(1)
    
    # Save to database
    db = load_database()
    
    # Check for duplicate name
    for student in db["students"]:
        if student["name"].lower() == args.name.lower():
            print(f"\n[WARN] Student '{args.name}' already exists (ID: {student['id']})")
            response = input("Overwrite? (y/n): ").strip().lower()
            if response == 'y':
                student["embedding"] = embedding.tolist()
                student["enrolled_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                save_database(db)
                print(f"[OK] Updated embedding for '{args.name}'")
                return
            else:
                print("[INFO] Enrollment cancelled.")
                return
    
    student_id = add_student(db, args.name, args.class_name, embedding)
    
    print(f"\n{'='*60}")
    print(f"  ENROLLMENT COMPLETE")
    print(f"  Student: {args.name}")
    print(f"  Class:   {args.class_name}")
    print(f"  ID:      {student_id}")
    print(f"  Vector:  512-d (L2-normalized)")
    print(f"  Saved:   {DB_PATH}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
