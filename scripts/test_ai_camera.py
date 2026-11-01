import os
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
VENV_PYTHON = REPO_ROOT / "ai-service" / "edge" / "venv" / "Scripts" / "python.exe"

# Auto-re-execute using the edge venv if invoked with global Python
if VENV_PYTHON.exists() and Path(sys.executable).resolve() != VENV_PYTHON.resolve():
    print(f"[NOTE] Global Python detected ({sys.executable}).")
    print(f"[NOTE] Auto re-executing with PRISM-AI edge venv: {VENV_PYTHON}\n")
    res = subprocess.run([str(VENV_PYTHON)] + sys.argv)
    sys.exit(res.returncode)

import cv2
import numpy as np

# Add edge directory to sys.path
EDGE_DIR = REPO_ROOT / "ai-service" / "edge"
sys.path.insert(0, str(EDGE_DIR))

import gpu_check
from face_recognition import (
    EmotionEngine,
    crop_face_with_padding,
    engagement_state_for,
    engagement_color,
    init_face_app,
    load_enrolled_students,
    match_face,
    EMOTION_MODEL_PATH,
)

def run_test(camera_idx=1, num_frames=15, output_image_path="test_camera_result.jpg"):
    print("=" * 60)
    print(f"PRISM-AI: Testing Camera {camera_idx} with Face + Emotion Models")
    print("=" * 60)

    # 1. Initialize FaceAnalysis (SCRFD + ArcFace) on GPU
    print("\n[STEP 1] Initializing InsightFace on GPU...")
    app = init_face_app(det_size=(320, 320))

    # 2. Initialize Emotion Model (YOLOv8 best_v2.onnx)
    print("\n[STEP 2] Initializing Emotion Model (best_v2.onnx)...")
    emotion_model = EmotionEngine(EMOTION_MODEL_PATH, ["CPUExecutionProvider"])

    # 3. Load enrolled students if any
    print("\n[STEP 3] Loading Enrolled Database...")
    enrolled_names, enrolled_embeddings, enrolled_uuids = load_enrolled_students()

    # 4. Open Camera
    print(f"\n[STEP 4] Opening Camera {camera_idx}...")
    cap = cv2.VideoCapture(camera_idx, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print("[WARN] DirectShow failed, trying default backend...")
        cap = cv2.VideoCapture(camera_idx)

    if not cap.isOpened() and camera_idx != 0:
        print(f"[WARN] Camera {camera_idx} could not be opened. Falling back to Camera 0...")
        camera_idx = 0
        cap = cv2.VideoCapture(camera_idx, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(camera_idx)

    if not cap.isOpened():
        print(f"[ERROR] Could not open camera {camera_idx}!")
        return False

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    print("[STEP 5] Warming up and capturing frames...")
    # Warm up camera for auto-exposure/white-balance
    for _ in range(5):
        cap.read()

    last_annotated_frame = None
    start_time = time.time()
    for frame_i in range(num_frames):
        t0 = time.time()
        ret, frame = cap.read()
        if not ret or frame is None:
            print(f"[WARN] Failed to read frame {frame_i}")
            continue

        annotated = frame.copy()
        h, w = frame.shape[:2]

        # Face analysis
        faces = app.get(frame)
        results = []
        for face in faces:
            bbox = face.bbox.astype(int)
            x1, y1, x2, y2 = bbox
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)

            name, similarity, uuid = match_face(
                face.embedding,
                enrolled_names,
                enrolled_embeddings,
                threshold=0.4,
                enrolled_uuids=enrolled_uuids,
            )

            face_crop = crop_face_with_padding(frame, bbox)
            emotion_res = emotion_model.classify_face(face_crop)
            if emotion_res:
                emotion, emotion_conf = emotion_res
            else:
                emotion, emotion_conf = "Unknown", 0.0

            eng_state = engagement_state_for(emotion)
            color = engagement_color(eng_state)

            results.append({
                "name": name,
                "similarity": float(similarity),
                "emotion": emotion,
                "emotion_conf": float(emotion_conf),
                "engagement_state": eng_state,
                "bbox": [int(x1), int(y1), int(x2), int(y2)],
            })

            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            label = f"{name} ({similarity:.2f}) | {emotion} ({emotion_conf:.2f})"
            cv2.putText(
                annotated,
                label,
                (x1, max(20, y1 - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                2,
                cv2.LINE_AA,
            )

        t_elapsed = time.time() - t0
        fps = 1.0 / max(1e-5, t_elapsed)
        cv2.putText(
            annotated,
            f"FPS: {fps:.1f} | Faces: {len(faces)}",
            (20, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 255),
            2,
            cv2.LINE_AA,
        )

        last_annotated_frame = annotated
        print(f"Frame {frame_i + 1}/{num_frames}: {len(faces)} face(s) detected, FPS: {fps:.1f}")
        for r in results:
            print(f"  -> Face: {r['name']} | Sim: {r['similarity']:.2f} | Emotion: {r['emotion']} ({r['emotion_conf']:.2f}) | State: {r['engagement_state']}")

    total_time = time.time() - start_time
    avg_fps = num_frames / total_time
    print(f"\n[SUMMARY] Processed {num_frames} frames in {total_time:.2f}s (Average FPS: {avg_fps:.1f})")

    cap.release()
    if last_annotated_frame is not None:
        cv2.imwrite(output_image_path, last_annotated_frame)
        print(f"[SAVED] Sample frame saved to: {output_image_path}")

    return True

if __name__ == "__main__":
    out_path = str(REPO_ROOT / "test_camera_result.jpg")
    success = run_test(camera_idx=1, num_frames=15, output_image_path=out_path)
    if success:
        print("\n[RESULT] Camera 1 (UGREEN) and AI model test COMPLETED SUCCESSFULLY!")
    else:
        print("\n[RESULT] Camera 1 (UGREEN) test FAILED.")
