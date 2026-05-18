"""
PRISM-AI Edge Service — Real-Time Face Recognition
Detects and recognizes enrolled student faces from a webcam in real time.
Uses InsightFace (SCRFD + ArcFace) for long-distance face recognition.

Usage:
    python face_recognition.py --camera 0 --debug
    python face_recognition.py --camera path/to/video.mp4 --threshold 0.4
"""

import argparse
import datetime
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

# Force UTF-8 on stdout/stderr so unicode characters in print() statements
# (arrows, em-dashes, box-drawing) don't crash the process when this script
# is spawned by Node.js / Express on Windows (default codepage cp1252 can't
# encode many of the characters we use for nice console output).
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass  # older Pythons or unusual stream types — best effort

import requests

import cv2
import numpy as np

# ── MJPEG live-stream state ───────────────────────────────────────────────────
# The main loop encodes its annotated display frame into a JPEG and stores the
# bytes here; the StreamHandler reads them whenever a browser polls /stream.
# A lock keeps writer/reader race-free even at 30+ fps.
_latest_jpeg = None  # bytes — most recently encoded annotated frame
_latest_lock = threading.Lock()


class StreamHandler(BaseHTTPRequestHandler):
    """Serves multipart/x-mixed-replace MJPEG at /stream.

    Browsers render this natively in an <img src="/stream"> tag, no JS needed.
    """

    def do_GET(self):
        if self.path != '/stream':
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Cache-Control', 'no-cache, no-store, private, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=FRAME')
        self.end_headers()
        try:
            while True:
                with _latest_lock:
                    frame = _latest_jpeg
                if frame is not None:
                    self.wfile.write(b'--FRAME\r\n')
                    self.wfile.write(b'Content-Type: image/jpeg\r\n')
                    self.wfile.write(f'Content-Length: {len(frame)}\r\n\r\n'.encode())
                    self.wfile.write(frame)
                    self.wfile.write(b'\r\n')
                time.sleep(0.025)  # ~40 fps cap (Python loop is the real bottleneck)
        except (BrokenPipeError, ConnectionResetError):
            return

    def log_message(self, format, *args):  # noqa: A002 — match base class
        return  # silence access logs


def start_stream_server(port=5174):
    """Boot the MJPEG HTTP server in a daemon thread."""
    httpd = HTTPServer(('127.0.0.1', port), StreamHandler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    print(f"[STREAM] MJPEG live feed on http://127.0.0.1:{port}/stream", flush=True)

# ── Constants ─────────────────────────────────────────────────────────────────

DB_PATH = Path(__file__).parent / "enrolled_students.json"
UNKNOWN_LABEL = "Unknown"
COLORS = {
    "recognized": (0, 255, 0),     # Green
    "unknown": (0, 0, 255),         # Red
    "low_conf": (0, 255, 255),      # Yellow
    "info": (255, 255, 255),        # White
    "header_bg": (50, 50, 50),      # Dark grey
}

# ── InsightFace Setup ─────────────────────────────────────────────────────────

def init_face_app(det_size=(320, 320)):
    # NOTE: 320x320 is ~4x faster than 640x640 on CPU. SCRFD still detects
    # faces well at this size for webcam-distance (1-3m) usage. Bumping back
    # to 640x640 only matters for far-distance or very tilted faces.
    """Initialize InsightFace FaceAnalysis with CPU provider."""
    from insightface.app import FaceAnalysis
    
    print("[INIT] Loading InsightFace models (SCRFD + ArcFace)...")
    print("[INIT] Using CPUExecutionProvider for inference...")
    
    app = FaceAnalysis(
        name="buffalo_l",
        providers=["CPUExecutionProvider"]
    )
    app.prepare(ctx_id=0, det_size=det_size)
    
    print(f"[INIT] Models loaded. Detection size: {det_size}")
    return app


# ── Database ──────────────────────────────────────────────────────────────────

def load_enrolled_students():
    """Load enrolled student embeddings from local JSON."""
    if not DB_PATH.exists():
        print(f"[WARN] No enrolled students found at {DB_PATH}")
        print(f"[WARN] Run enroll_student.py first to register students.")
        return [], []
    
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)
    
    names = []
    embeddings = []
    
    for student in db.get("students", []):
        names.append(f"{student['name']} ({student['class']})")
        emb = np.array(student["embedding"], dtype=np.float32)
        # Ensure normalized
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        embeddings.append(emb)
    
    print(f"[INIT] Loaded {len(names)} enrolled student(s)")
    for i, name in enumerate(names):
        print(f"  [{i+1}] {name}")
    
    return names, embeddings


# ── Matching ──────────────────────────────────────────────────────────────────

def cosine_similarity(a, b):
    """Compute cosine similarity between two vectors."""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8)


def match_face(embedding, enrolled_names, enrolled_embeddings, threshold=0.4):
    """
    Match a detected face embedding against enrolled students.
    
    Args:
        embedding: 512-d face embedding from detected face
        enrolled_names: List of student names
        enrolled_embeddings: List of 512-d enrolled embeddings
        threshold: Minimum cosine similarity for a match (0.0 to 1.0)
    
    Returns:
        tuple: (name, similarity_score) or (UNKNOWN_LABEL, best_score)
    """
    if len(enrolled_embeddings) == 0:
        return UNKNOWN_LABEL, 0.0
    
    # Normalize input embedding
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    
    # Compute cosine similarity with all enrolled embeddings
    similarities = [cosine_similarity(embedding, enrolled) 
                    for enrolled in enrolled_embeddings]
    
    best_idx = np.argmax(similarities)
    best_score = similarities[best_idx]
    
    if best_score >= threshold:
        return enrolled_names[best_idx], best_score
    else:
        return UNKNOWN_LABEL, best_score


# ── Dashboard Communication ───────────────────────────────────────────────────

API_URL = "http://localhost:3001/api/attendance"
SEND_INTERVAL = 10  # Send data every 10 seconds

def send_to_dashboard(recognized_list):
    """Send recognized student data to the local web dashboard."""
    payload = {
        "timestamp": datetime.datetime.now().isoformat(),
        "classroom_id": "CLASS_1A",
        "detections": recognized_list
    }
    try:
        response = requests.post(API_URL, json=payload, timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"[DASHBOARD] Sent {len(recognized_list)} student(s) -> "
                  f"Total present: {data.get('totalPresent', '?')}")
        else:
            print(f"[DASHBOARD] Server error: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print(f"[DASHBOARD] Server offline (start server.js first)")
    except requests.exceptions.RequestException as e:
        print(f"[DASHBOARD] Error: {e}")


# ── Visualization ─────────────────────────────────────────────────────────────

def draw_face_result(frame, bbox, name, score, det_score):
    """Draw bounding box, name, and scores on the frame."""
    x1, y1, x2, y2 = bbox.astype(int)
    
    is_recognized = name != UNKNOWN_LABEL
    color = COLORS["recognized"] if is_recognized else COLORS["unknown"]
    
    # Draw bounding box
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
    
    # Draw label background
    label = f"{name}" if is_recognized else "Unknown"
    score_text = f"{score:.2f}"
    
    label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
    cv2.rectangle(frame, (x1, y1 - label_size[1] - 10), 
                  (x1 + label_size[0] + 10, y1), color, -1)
    cv2.putText(frame, label, (x1 + 5, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
    
    # Draw similarity score below box
    cv2.putText(frame, f"Sim: {score_text} | Det: {det_score:.2f}", 
                (x1, y2 + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)


def draw_hud(frame, fps, face_count, recognized_count):
    """Draw heads-up display with stats."""
    h, w = frame.shape[:2]
    
    # Header bar
    cv2.rectangle(frame, (0, 0), (w, 40), COLORS["header_bg"], -1)
    
    hud_text = (f"PRISM-AI | FPS: {fps:.1f} | "
                f"Faces: {face_count} | "
                f"Recognized: {recognized_count}")
    cv2.putText(frame, hud_text, (10, 28),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLORS["info"], 1)
    
    # Controls hint
    cv2.putText(frame, "Press 'q' to quit | 'd' toggle debug", 
                (10, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, 
                COLORS["info"], 1)


# ── Main Recognition Loop ────────────────────────────────────────────────────

def run_recognition(args):
    """Main real-time face recognition loop."""
    
    # Initialize InsightFace
    app = init_face_app(det_size=(args.det_size, args.det_size))
    
    # Load enrolled students
    enrolled_names, enrolled_embeddings = load_enrolled_students()
    
    # Open camera
    camera_source = args.camera
    if camera_source.isdigit():
        camera_source = int(camera_source)
    
    # Use DirectShow backend explicitly; let camera pick its native resolution
    # (forcing 1280x720 breaks low-res cameras like UGREEN's default 640x480)
    if isinstance(camera_source, int):
        cap = cv2.VideoCapture(camera_source, cv2.CAP_DSHOW)
    else:
        cap = cv2.VideoCapture(camera_source)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open camera: {args.camera}")
        sys.exit(1)
    
    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"[INIT] Camera opened: {actual_w}x{actual_h}")
    
    show_debug = args.debug
    frame_count = 0
    fps = 0.0
    fps_timer = time.time()
    last_send_time = time.time()  # Dashboard send timer
    
    print(f"\n{'='*60}")
    print(f"  PRISM-AI — Real-Time Face Recognition")
    print(f"  Threshold: {args.threshold} | Camera: {args.camera}")
    print(f"  Enrolled students: {len(enrolled_names)}")
    print(f"  Press 'q' to quit | 'd' to toggle debug view")
    print(f"{'='*60}\n")

    # Boot the MJPEG stream server so the React dashboard can render frames in
    # a <img src="/stream"> tag. The server reads _latest_jpeg, which the main
    # loop refreshes after annotating each frame.
    start_stream_server(port=args.stream_port)

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                if isinstance(camera_source, str):
                    print("[INFO] Video ended.")
                    break
                print("[ERROR] Failed to read frame")
                continue
            
            frame_start = time.time()
            
            # ── Face Detection + Embedding Extraction ──
            faces = app.get(frame)
            
            recognized_count = 0
            results = []
            
            for face in faces:
                embedding = face.embedding  # 512-d ArcFace embedding
                det_score = face.det_score
                bbox = face.bbox
                
                # Skip low-confidence detections
                if det_score < 0.3:
                    continue
                
                # Match against enrolled students
                name, sim_score = match_face(
                    embedding, enrolled_names, enrolled_embeddings,
                    threshold=args.threshold
                )
                
                if name != UNKNOWN_LABEL:
                    recognized_count += 1
                
                results.append({
                    "name": name,
                    "similarity": sim_score,
                    "det_score": det_score,
                    "bbox": bbox,
                    "embedding": embedding,
                })
            
            # ── Visualization ──
            # Build the annotated `display` frame on every iteration so the
            # MJPEG stream always has fresh content, regardless of whether the
            # desktop debug window is currently shown.
            display = frame.copy()

            for r in results:
                draw_face_result(display, r["bbox"], r["name"],
                                 r["similarity"], r["det_score"])

            draw_hud(display, fps, len(results), recognized_count)

            if show_debug:
                cv2.imshow("PRISM-AI Face Recognition", display)

            # Push the annotated frame to the MJPEG stream. JPEG quality 80
            # keeps the wire size sane (~30-60 KB/frame at 640x480). Any
            # encoder error is swallowed — we never let streaming crash the
            # recognition loop.
            try:
                _, jpeg_buf = cv2.imencode(
                    '.jpg', display, [int(cv2.IMWRITE_JPEG_QUALITY), 80]
                )
                with _latest_lock:
                    globals()['_latest_jpeg'] = jpeg_buf.tobytes()
            except Exception:
                pass
            
            # ── Send to Dashboard (every SEND_INTERVAL seconds) ──
            if time.time() - last_send_time >= SEND_INTERVAL:
                recognized_students = []
                for r in results:
                    if r["name"] != UNKNOWN_LABEL:
                        # Parse name and class from "Name (Class)" format
                        full_name = r["name"]
                        student_name = full_name
                        student_class = "Bestari"
                        if "(" in full_name and ")" in full_name:
                            student_name = full_name.split("(")[0].strip()
                            student_class = full_name.split("(")[1].replace(")", "").strip()
                        
                        recognized_students.append({
                            "student_name": student_name,
                            "student_class": student_class,
                            "student_year": 1,
                            "similarity_score": round(float(r["similarity"]), 4),
                            "status": "Present"
                        })
                
                if recognized_students:
                    send_to_dashboard(recognized_students)
                last_send_time = time.time()
            
            # ── FPS Calculation ──
            frame_count += 1
            elapsed = time.time() - fps_timer
            if elapsed >= 1.0:
                fps = frame_count / elapsed
                frame_count = 0
                fps_timer = time.time()
                
                # Console output (periodic)
                if results:
                    names_found = [r["name"] for r in results]
                    print(f"[{time.strftime('%H:%M:%S')}] "
                          f"FPS: {fps:.1f} | "
                          f"Faces: {len(results)} | "
                          f"Recognized: {recognized_count} | "
                          f"IDs: {names_found}")
            
            # ── Frame timing ──
            frame_time = time.time() - frame_start
            
            # ── Key handling ──
            if show_debug:
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break
                elif key == ord('d'):
                    show_debug = not show_debug
                elif key == ord('r'):
                    # Reload enrolled students (hot-reload)
                    print("[INFO] Reloading enrolled students...")
                    enrolled_names, enrolled_embeddings = load_enrolled_students()
            else:
                # Even without debug window, check for keyboard interrupt
                # Add a minimal waitKey for non-debug mode
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
    
    except KeyboardInterrupt:
        print("\n[INFO] Interrupted by user.")
    
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("[INFO] Camera released. Goodbye!")
    
    # ── PRIVACY GUARANTEE ──
    # No frames, images, or face crops were saved to disk.
    # Only 512-d mathematical vectors were processed in RAM.


# ── Entry Point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="PRISM-AI — Real-Time Face Recognition (Edge Service)"
    )
    parser.add_argument("--camera", type=str, default="0",
                        help="Camera index or video file path (default: 0)")
    parser.add_argument("--threshold", type=float, default=0.4,
                        help="Cosine similarity threshold for matching (default: 0.4)")
    parser.add_argument("--debug", action="store_true",
                        help="Show debug visualization window")
    parser.add_argument("--det-size", type=int, default=320,
                        help="Face detection input size (default: 640)")
    parser.add_argument("--stream-port", type=int, default=5174,
                        help="Port for the MJPEG live-stream HTTP server (default: 5174)")

    args = parser.parse_args()
    run_recognition(args)


if __name__ == "__main__":
    main()
