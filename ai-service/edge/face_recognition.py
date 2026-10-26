"""
PRISM-AI Edge Service — Real-Time Face Recognition + Emotion Engine
Detects and recognizes enrolled student faces from a webcam in real time,
and labels each face with a classroom-engagement emotion.

Two-thread architecture (fixes the low display FPS: the main loop only
captures/annotates/encodes, never runs GPU inference):
  Thread 1 (display, main thread): capture frame -> draw the CACHED face
      boxes + emotion labels -> JPEG encode -> publish _latest_jpeg.
      Targets 25-30 fps.
  Thread 2 (AI worker, daemon): every DETECT_EVERY_N new frames, grab the
      latest shared frame -> InsightFace (SCRFD) detection -> ArcFace
      recognition -> emotion inference every EMOTION_INTERVAL seconds ->
      atomically swap the shared annotation cache.

Shared state (all guarded by _cache_lock):
  annotation_cache — list of dicts (name, bbox, similarity, student_uuid,
      emotion, engagement_state, emotion_confidence, det_score)
  latest_frame     — newest raw camera frame (numpy array)

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
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
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

import gpu_check

# ── MJPEG live-stream state ───────────────────────────────────────────────────
# The display loop encodes its annotated frame into a JPEG and stores the
# bytes here; the StreamHandler reads them whenever a browser polls /stream.
# A lock keeps writer/reader race-free even at 30+ fps.
_latest_jpeg = None  # bytes — most recently encoded annotated frame
_latest_lock = threading.Lock()

# ── Shared AI/annotation state (display thread ⇄ AI worker thread) ───────────
# annotation_cache holds the most recent recognition results; the display
# thread only ever READS it (quick copy under the lock) and the AI worker
# replaces its content wholesale after each detection cycle. Entries are
# never mutated after publication, so a shallow list copy is a consistent
# snapshot for drawing.
_cache_lock = threading.Lock()
annotation_cache = []       # list of dicts — newest recognition results
latest_frame = None         # np.ndarray BGR — newest raw camera frame
_frame_seq = 0              # increments once per captured frame


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
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            # Browser closed the connection (page navigation, reload, retry).
            # Just exit this handler cleanly so the server can accept new connections.
            return

    def log_message(self, format, *args):  # noqa: A002 — match base class
        return  # silence access logs


def start_stream_server(port=5174):
    """Boot the MJPEG HTTP server in a daemon thread.

    Uses ThreadingHTTPServer (not HTTPServer) so each browser connection
    gets its own thread. Without this, a single hanging/aborted MJPEG
    connection blocks the whole server and new connections fail. This is
    important because the React auto-retry can rapidly open many
    connections during the model-loading window.
    """
    httpd = ThreadingHTTPServer(('127.0.0.1', port), StreamHandler)
    httpd.daemon_threads = True  # don't keep the process alive on shutdown
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    print(f"[STREAM] MJPEG live feed on http://127.0.0.1:{port}/stream", flush=True)

# ── Constants ─────────────────────────────────────────────────────────────────

DB_PATH = Path(__file__).parent / "enrolled_students.json"
UNKNOWN_LABEL = "Unknown"
COLORS = {
    "attentive": (0, 255, 0),        # Green — engagement_state 'attentive'
    "disengaged": (0, 0, 255),       # Red — engagement_state 'disengaged'
    "unknown_emotion": (160, 160, 160),  # Grey — no emotion attached yet
    "low_conf": (0, 255, 255),       # Yellow
    "info": (255, 255, 255),         # White
    "header_bg": (50, 50, 50),       # Dark grey
}

# ── Two-thread tuning knobs ───────────────────────────────────────────────────
DETECT_EVERY_N = 3        # AI worker runs InsightFace every 3rd new frame
EMOTION_INTERVAL = 2.0    # seconds between emotion-inference passes
EMOTION_CONF_THRESHOLD = 0.25   # min YOLO score to keep an emotion box
EMOTION_NMS_IOU = 0.45          # NMS overlap threshold for emotion boxes
FACE_CROP_PADDING = 30          # px of context added around each face crop

# ONNX export of the YOLOv8 emotion detector (built from best_v2.pt by the
# model-export lane; best_v2.pt lives next to this script).
EMOTION_MODEL_PATH = Path(__file__).parent / "best_v2.onnx"

# Class order verified from the best_v2.pt checkpoint ('names' dict in the
# pickled train args): 10 classes, index 0..9. The ONNX file carries the same
# mapping in its metadata; this list is only the fallback when metadata is
# absent. Note 'neutral' is lowercase in the checkpoint — matching is
# case-insensitive everywhere below.
FALLBACK_EMOTION_CLASSES = [
    "Angry", "Disgust", "Excited", "Fear", "Happy",
    "Sad", "Serious", "Thinking", "Worried", "neutral",
]

# Emotion → classroom engagement mapping (case-insensitive), approved mapping:
# attentive  = Neutral, Happy, Excited, Serious, Thinking
# disengaged = Sad, Angry, Fear, Disgust, Worried
ATTENTIVE_EMOTIONS = {"neutral", "happy", "excited", "serious", "thinking"}
DISENGAGED_EMOTIONS = {"sad", "angry", "fear", "disgust", "worried"}

# CUDA-only VRAM ceilings (bytes) for onnxruntime session arenas. DirectML has
# no memory-cap provider option — see gpu_provider_options().
INSIGHTFACE_GPU_MEM_LIMIT = 2 * 1024 * 1024 * 1024   # 2 GiB per ORT session
EMOTION_GPU_MEM_LIMIT = 512 * 1024 * 1024            # 512 MiB


def engagement_state_for(emotion):
    """Map a raw emotion class name to 'attentive'/'disengaged' (or None)."""
    if not emotion:
        return None
    key = str(emotion).strip().lower()
    if key in ATTENTIVE_EMOTIONS:
        return "attentive"
    if key in DISENGAGED_EMOTIONS:
        return "disengaged"
    return None


def engagement_color(engagement_state):
    """BGR box color for an engagement state (green/red/gray)."""
    if engagement_state == "attentive":
        return COLORS["attentive"]
    if engagement_state == "disengaged":
        return COLORS["disengaged"]
    return COLORS["unknown_emotion"]


# ── GPU session options ───────────────────────────────────────────────────────

def gpu_provider_options(providers, gpu_mem_limit=INSIGHTFACE_GPU_MEM_LIMIT):
    """Build onnxruntime provider_options aligned 1:1 with `providers`.

    insightface 0.7.3 forwards FaceAnalysis(**kwargs) straight through to
    model_zoo.get_model() → InferenceSession(**kwargs), so provider_options
    can be set via the FaceAnalysis API the same way as the providers param
    (added in deepinsight/insightface#1726). Verified in the installed copy:
    PickableInferenceSession.__init__ passes **kwargs to onnxruntime.

    VRAM limits are best-effort per execution provider:
      - CUDAExecutionProvider: gpu_mem_limit caps the arena and
        arena_extend_strategy='kSameAsRequested' stops the allocator from
        doubling the reservation on every growth spike.
      - DmlExecutionProvider: has NO memory-cap option (only device_id) —
        documented limitation; DML manages its own residency.
    """
    options = []
    for provider in providers:
        if provider == "CUDAExecutionProvider":
            options.append({
                "device_id": "0",
                "gpu_mem_limit": int(gpu_mem_limit),
                "arena_extend_strategy": "kSameAsRequested",
            })
        elif provider == "DmlExecutionProvider":
            options.append({"device_id": "0"})
        else:
            options.append({})
    return options


# ── Emotion Engine (YOLOv8 ONNX) ──────────────────────────────────────────────

def read_onnx_class_names(session, fallback):
    """Read the class-index→name map from ONNX metadata, else `fallback`.

    Ultralytics exports store the training class dict in the model's metadata
    under the 'names' key (e.g. "{0: 'Angry', 1: 'Disgust', ...}"). The dict
    literal is Python-style, so json.loads is tried first and
    ast.literal_eval second.
    """
    try:
        meta = session.get_modelmeta().custom_metadata_map
    except Exception:
        return fallback
    raw = meta.get("names") or meta.get("classes")
    if not raw:
        return fallback
    import ast
    for loader in (json.loads, ast.literal_eval):
        try:
            parsed = loader(raw)
        except Exception:
            continue
        if isinstance(parsed, dict):
            try:
                names = [str(parsed[k]) for k in sorted(parsed, key=lambda x: int(x))]
            except (ValueError, TypeError, KeyError):
                continue
            print(f"[EMOTION] Class map from ONNX metadata: {names}")
            return names
    return fallback


def _letterbox(frame, size):
    """Resize `frame` to size×size with letterbox padding (YOLO convention).

    Returns (padded_image, gain, pad_x, pad_y) so boxes can be mapped back to
    original frame coordinates.
    """
    h, w = frame.shape[:2]
    gain = min(size / h, size / w)
    new_w, new_h = int(round(w * gain)), int(round(h * gain))
    resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    padded = np.full((size, size, 3), 114, dtype=np.uint8)
    pad_x, pad_y = (size - new_w) // 2, (size - new_h) // 2
    padded[pad_y:pad_y + new_h, pad_x:pad_x + new_w] = resized
    return padded, gain, pad_x, pad_y


def parse_yolo_predictions(pred, num_classes, gain, pad_x, pad_y,
                           conf_threshold=EMOTION_CONF_THRESHOLD,
                           frame_wh=None):
    """Parse a raw YOLOv8 ONNX output tensor into per-face emotion detections.

    `pred` is the first session output: (1, 4+nc, 8400) or (8400, 4+nc) —
    rows are (cx, cy, w, h, class_scores...) in letterbox space. Returns a
    list of dicts {bbox, emotion, confidence} in ORIGINAL frame coordinates
    (pass frame_wh=(w, h) to clamp boxes to the frame).

    Exported emotion classes can shift if lane 2 re-orders the dataset —
    callers resolve names via read_onnx_class_names() so indices stay in sync
    with the metadata, never with a hardcoded order.
    """
    pred = np.asarray(pred)
    if pred.ndim == 3:  # squeeze the batch dim
        pred = pred[0]
    # Ultralytics v8 layout: channels-first (4+nc, N); some exports are (N, 4+nc).
    if pred.shape[0] == 4 + num_classes and pred.shape[0] < pred.shape[-1]:
        pred = pred.T
    if pred.ndim != 2 or pred.shape[1] != 4 + num_classes:
        return []

    boxes_cxcywh = pred[:, :4]
    scores = pred[:, 4:]
    if scores.shape[1] != num_classes:
        return []

    class_ids = scores.argmax(axis=1)
    confs = scores.max(axis=1)
    keep = confs >= conf_threshold
    if not np.any(keep):
        return []
    boxes_cxcywh = boxes_cxcywh[keep]
    class_ids = class_ids[keep]
    confs = confs[keep]

    # cxcywh → xyxy, then undo the letterbox (subtract pad, divide by gain).
    cx, cy, w, h = boxes_cxcywh[:, 0], boxes_cxcywh[:, 1], boxes_cxcywh[:, 2], boxes_cxcywh[:, 3]
    x1 = (cx - w / 2 - pad_x) / gain
    y1 = (cy - h / 2 - pad_y) / gain
    x2 = (cx + w / 2 - pad_x) / gain
    y2 = (cy + h / 2 - pad_y) / gain

    dets = np.stack([x1, y1, x2, y2, confs, class_ids.astype(np.float32)], axis=1)

    # supervision provides the NMS utility (xyxy + conf + class columns) and
    # returns a boolean keep-mask; we build Detections manually after it.
    import supervision as sv
    keep_mask = sv.box_non_max_suppression(dets[:, :6], iou_threshold=EMOTION_NMS_IOU)
    dets = dets[keep_mask]

    results = []
    for row in dets:
        bbox = [float(row[0]), float(row[1]), float(row[2]), float(row[3])]
        if frame_wh is not None:
            fw, fh = frame_wh
            bbox = [max(0.0, min(bbox[0], fw - 1)), max(0.0, min(bbox[1], fh - 1)),
                    max(0.0, min(bbox[2], fw - 1)), max(0.0, min(bbox[3], fh - 1))]
        results.append({
            "bbox": bbox,
            "confidence": float(row[4]),
            "class_id": int(row[5]),
        })
    return results


def crop_face_with_padding(frame, bbox, pad=FACE_CROP_PADDING):
    """Crop `frame` around an InsightFace bbox with `pad` px of context.

    bbox is [x1, y1, x2, y2] (floats, InsightFace convention); the padded
    rectangle is clamped to the frame bounds. Returns None for degenerate
    boxes that fall entirely outside the frame.
    """
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = np.asarray(bbox, dtype=np.float32)
    xa, ya = int(max(0, x1 - pad)), int(max(0, y1 - pad))
    xb, yb = int(min(w, x2 + pad)), int(min(h, y2 + pad))
    if xb <= xa or yb <= ya:
        return None
    return frame[ya:yb, xa:xb]


class EmotionEngine:
    """YOLOv8 ONNX emotion classifier over cropped face regions.

    InsightFace finds the faces; this engine only LABELS them. Each face crop
    (see crop_face_with_padding) is letterboxed and classified individually,
    so the model sees an actual face instead of the edge artifacts a
    full-frame YOLO run locks onto. Runs on CPU, far less often than
    detection — once per EMOTION_INTERVAL seconds in the AI worker thread.
    """

    def __init__(self, model_path, providers):
        import onnxruntime as ort

        self.classes = FALLBACK_EMOTION_CLASSES
        self.session = None
        if not model_path.exists():
            raise FileNotFoundError(f"emotion model not found: {model_path}")

        print(f"[EMOTION] Loading {model_path.name} on providers: {providers}")
        # Run the emotion model on CPU: two DmlExecutionProvider sessions
        # (InsightFace + emotion) conflict on the same GPU and silently degrade
        # InsightFace's detection after minutes of concurrent use. The emotion
        # model only runs every EMOTION_INTERVAL seconds on a single frame, so
        # CPU inference (~100-200ms) is imperceptible.
        emotion_providers = ['CPUExecutionProvider']
        self.session = ort.InferenceSession(
            str(model_path),
            providers=emotion_providers,
        )
        self.input_name = self.session.get_inputs()[0].name

        # Static exports pin the input size in the shape (e.g. [1,3,640,640]);
        # dynamic exports fall back to YOLOv8's default 640.
        shape = self.session.get_inputs()[0].shape
        size = 640
        if isinstance(shape, (list, tuple)) and len(shape) >= 4 and isinstance(shape[2], int):
            size = shape[2]
        self.input_size = size

        self.classes = read_onnx_class_names(self.session, FALLBACK_EMOTION_CLASSES)
        print(f"[EMOTION] Ready — {len(self.classes)} classes, input {size}x{size}")

    def classify_face(self, face_crop):
        """Classify one cropped face region; (emotion, confidence) or None.

        The crop already centers on an InsightFace detection, so the YOLO
        model only has to label it: the highest-confidence detection wins and
        'nothing above threshold' simply means the emotion is unknown (None).
        """
        if self.session is None or face_crop is None or face_crop.size == 0:
            return None
        padded, gain, pad_x, pad_y = _letterbox(face_crop, self.input_size)
        # NOTE: best_v2.pt was trained on raw 0-255 pixel values, NOT
        # normalized 0-1. Dividing by 255 crushes the signal to near-zero
        # (verified: 0.0019 max confidence vs 0.9985 without normalization).
        blob = padded[:, :, ::-1].transpose(2, 0, 1)[None].astype(np.float32)
        outputs = self.session.run(None, {self.input_name: blob})

        # Boxes stay in crop coordinates (no frame_wh clamp) — only the label
        # and score are consumed, never the geometry.
        raw = parse_yolo_predictions(
            outputs[0], len(self.classes), gain, pad_x, pad_y
        )
        if not raw:
            return None
        best = max(raw, key=lambda det: det["confidence"])
        return self.classes[best["class_id"]], best["confidence"]


# ── InsightFace Setup ─────────────────────────────────────────────────────────

def init_face_app(det_size=(320, 320)):
    # NOTE: 320x320 is ~4x faster than 640x640 on SCRFD and still detects
    # faces well at webcam distance (1-3m). Bumping back to 640x640 only
    # matters for far-distance or very tilted faces.
    """Initialize InsightFace FaceAnalysis on a GPU execution provider."""
    from insightface.app import FaceAnalysis

    # No GPU → refuses (exit 3) before the camera is ever opened.
    providers = gpu_check.require_gpu_providers()
    det_size = gpu_check.effective_det_size(providers, det_size)

    print("[INIT] Loading InsightFace models (SCRFD + ArcFace)...")
    print(f"[INIT] Requesting execution providers: {providers}")

    app = FaceAnalysis(
        name="buffalo_l",
        providers=providers,
        provider_options=gpu_provider_options(providers),
        # This service only uses bbox/kps/det_score/embedding — skip the
        # genderage + two landmark models, saving 3 GPU dispatches per face
        # per frame (measured 4.4 -> 10.4 fps with 6 faces on DirectML).
        allowed_modules=["detection", "recognition"],
    )
    app.prepare(ctx_id=0, det_size=det_size)

    active = gpu_check.verify_gpu_active(app)
    print(f"[INIT] GPU inference active: {', '.join(sorted(active))}")
    print(f"[INIT] Models loaded. Detection size: {det_size}")
    return app


# ── Database ──────────────────────────────────────────────────────────────────

def load_enrolled_students():
    """Load enrolled student embeddings from local JSON."""
    if not DB_PATH.exists():
        print(f"[WARN] No enrolled students found at {DB_PATH}")
        print(f"[WARN] Run enroll_student.py first to register students.")
        return [], [], []

    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    names = []
    embeddings = []
    uuids = []

    for student in db.get("students", []):
        names.append(f"{student['name']} ({student['class']})")
        # Supabase UUID, may be absent in pre-UUID enrollment records —
        # stored as None and sent as null (server falls back to name match).
        uuids.append(student.get("student_uuid"))
        emb = np.array(student["embedding"], dtype=np.float32)
        # Ensure normalized
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        embeddings.append(emb)

    print(f"[INIT] Loaded {len(names)} enrolled student(s)")
    for i, name in enumerate(names):
        print(f"  [{i+1}] {name}")

    return names, embeddings, uuids


# ── Matching ──────────────────────────────────────────────────────────────────

def cosine_similarity(a, b):
    """Compute cosine similarity between two vectors."""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8)


def match_face(embedding, enrolled_names, enrolled_embeddings, threshold=0.4,
               enrolled_uuids=None):
    """
    Match a detected face embedding against enrolled students.

    Args:
        embedding: 512-d face embedding from detected face
        enrolled_names: List of student names
        enrolled_embeddings: List of 512-d enrolled embeddings
        threshold: Minimum cosine similarity for a match (0.0 to 1.0)
        enrolled_uuids: Optional list of Supabase UUIDs, index-aligned with
            enrolled_names/enrolled_embeddings (None entries for old records)

    Returns:
        tuple: (name, similarity_score, student_uuid) — student_uuid is None
        for unknown faces or enrollments without a UUID
    """
    if len(enrolled_embeddings) == 0:
        return UNKNOWN_LABEL, 0.0, None

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
        # Same similarity logic as before — the UUID is only metadata carried
        # alongside the winning match (None for old enrollment records).
        student_uuid = (enrolled_uuids[best_idx]
                        if enrolled_uuids is not None else None)
        return enrolled_names[best_idx], best_score, student_uuid
    else:
        return UNKNOWN_LABEL, best_score, None


# ── Dashboard Communication ───────────────────────────────────────────────────

API_URL = "http://localhost:3001/api/attendance"
# The Express bridge rejects POST /api/attendance unless it carries the shared
# secret as the X-API-Key header. SET AI_BRIDGE_KEY in the environment BEFORE
# running this script (same value as server/.env — see server/.env.example);
# if it is missing or wrong, the server answers 401 and no detections land.
AI_BRIDGE_KEY = os.environ.get('AI_BRIDGE_KEY', '')
SEND_INTERVAL = 10  # Send data every 10 seconds

# ── 60-second sustained-absence rule ─────────────────────────────────────────
# Project decision: a recognized student whose face disappears for 60
# continuous seconds is sampled as NOT ENGAGED while they are absent (the
# note-taking rule: a student may look away from the camera for a minute to
# write, and that stretch must still land in the engagement record instead of
# silently vanishing between detections). The edge service remembers the last
# known state of every matched identity and, once an identity has been gone
# for ABSENCE_SYNTHETIC_THRESHOLD seconds, appends one synthetic 'no_face'
# detection per absent identity per dashboard tick. These rows carry
# engagement_only: true, so the server skips them for attendance but still
# counts them for engagement.
ABSENCE_SYNTHETIC_THRESHOLD = 60.0  # seconds of continuous absence before rows emit
# Sanity bound: a payload never carries more than this many synthetic rows.
# The map below is roster-bounded, so hitting the cap means something unusual
# (camera covered, whole class away); one giant payload should not be built
# from that. Longest-absent identities fill the budget first.
ABSENCE_MAX_ROWS = 30

# The 10 emotion labels the engine can emit (see FALLBACK_EMOTION_CLASSES),
# compared lowercased ('neutral' is lowercase in the checkpoint). A
# detection's emotion is remembered as an absent identity's last known
# emotion only when it is one of these labels; anything else counts as "no
# emotion this pass" and never overwrites a good stored label.
VALID_EMOTION_LABELS = {c.strip().lower() for c in FALLBACK_EMOTION_CLASSES}

# Session-lifetime "last seen" map for the sustained-absence rule.
# Key: student_uuid when the enrollment record has one, else the matched name
# string ("Name (Class)"). Value: last_seen_monotonic plus the last known
# display name, class and emotion. Bounded by the roster size: at most one
# entry per enrolled identity that was ever matched this session, never one
# per detection or per frame. Written only by the AI worker thread; the
# display thread reads a copied snapshot when it builds the payload.
_absence_lock = threading.Lock()
_last_seen_map = {}  # identity_key -> last-seen entry dict (see note_identity_seen)


def split_display_name(full_name):
    """Split a matched name "Name (Class)" into (student_name, student_class).

    Single copy of the parsing the dashboard payload has always used, so live
    rows and synthetic absence rows spell name and class identically.
    """
    student_name = full_name
    student_class = "Bestari"
    if "(" in full_name and ")" in full_name:
        student_name = full_name.split("(")[0].strip()
        student_class = full_name.split("(")[1].replace(")", "").strip()
    return student_name, student_class


def note_identity_seen(full_name, student_uuid, emotion, now_monotonic=None):
    """Record that a recognized identity was just matched (absence map).

    Called once per matched identity on each AI pass. This single update is
    the whole reset mechanism of the 60-second rule: while a face keeps
    matching, last_seen keeps moving and no synthetic row can fire; the
    moment matching stops, last_seen stops moving and the absence starts
    aging. `emotion` is stored only when it is one of the 10 valid labels,
    so an unclassified pass never erases the last known emotion.
    """
    if now_monotonic is None:
        now_monotonic = time.monotonic()
    identity_key = student_uuid if student_uuid else full_name
    student_name, student_class = split_display_name(full_name)
    last_emotion = emotion if (
        emotion and str(emotion).strip().lower() in VALID_EMOTION_LABELS
    ) else None
    with _absence_lock:
        entry = _last_seen_map.get(identity_key)
        if entry is None:
            # Roster-bounded: one entry per enrolled identity ever matched.
            _last_seen_map[identity_key] = {
                "last_seen_monotonic": now_monotonic,
                "student_name": student_name,
                "last_class": student_class,
                "last_emotion": last_emotion,
                "student_uuid": student_uuid,
            }
        else:
            entry["last_seen_monotonic"] = now_monotonic
            if last_emotion is not None:
                entry["last_emotion"] = last_emotion


def build_absent_rows(seen_snapshot, now_monotonic,
                      absence_threshold=ABSENCE_SYNTHETIC_THRESHOLD,
                      max_rows=ABSENCE_MAX_ROWS):
    """Build synthetic 'no_face' rows for identities absent long enough.

    Pure function over a caller-provided snapshot of the last-seen map
    (copied entries, never the live map) so the 60-second rule is testable
    without a camera or threads. An identity earns one row per dashboard tick
    once now_monotonic - last_seen_monotonic >= absence_threshold; an
    identity never matched this session is not in the map and can never be
    emitted.

    Rows are payload-only: they are appended to the dashboard payload and
    never to annotation_cache, so an absent identity can never appear in the
    live overlay or the MJPEG stream. emotion falls back to 'Neutral'
    because the database CHECK constraint requires one of the 10 labels.
    """
    rows = []
    # Longest-absent first, so when the sanity cap bites it drops the
    # identities that were seen most recently.
    ordered = sorted(seen_snapshot.items(),
                     key=lambda kv: kv[1]["last_seen_monotonic"])
    for identity_key, info in ordered:
        if now_monotonic - info["last_seen_monotonic"] < absence_threshold:
            continue
        emotion = info.get("last_emotion")
        if not emotion or str(emotion).strip().lower() not in VALID_EMOTION_LABELS:
            emotion = "Neutral"
        rows.append({
            "student_name": info.get("student_name") or identity_key,
            "student_class": info.get("last_class"),
            "student_uuid": info.get("student_uuid"),
            # No face is on camera, so there is no fresh similarity score.
            "similarity_score": None,
            # Attendance is decided by the server, which skips engagement_only
            # rows entirely; the value only keeps the row shape uniform.
            "status": "Present",
            "emotion": emotion,
            "engagement_state": "no_face",
            "emotion_confidence": None,
            # The flag the server keys on: skip for attendance, count for
            # engagement as a sustained-absence sample.
            "engagement_only": True,
        })
        if len(rows) >= max_rows:
            break
    return rows


def send_to_dashboard(recognized_list):
    """Send recognized student data to the local web dashboard."""
    payload = {
        "timestamp": datetime.datetime.now().isoformat(),
        "classroom_id": "CLASS_1A",
        "detections": recognized_list
    }
    try:
        response = requests.post(
            API_URL, json=payload, timeout=5,
            headers={'X-API-Key': AI_BRIDGE_KEY}
        )
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


# ── AI Worker (Thread 2) ──────────────────────────────────────────────────────

def ai_worker_loop(app_holder, emotion_engine, db_holder, threshold, stop_event):
    """Thread-2 body: detection + recognition + emotion on the shared frame.

    Consumes only every DETECT_EVERY_N-th NEW camera frame (skipping keeps
    latency low when inference is slower than the display capture rate). Each
    InsightFace face is cropped (padded bbox) and classified individually by
    the emotion engine — no IoU matching, the crop IS the face. After each
    cycle it atomically swaps the shared annotation cache; the display thread
    draws that cache without ever waiting on GPU inference.
    """
    frames_seen = 0
    last_seq = -1
    last_emotion_time = 0.0
    last_emotions = []   # per-face (emotion, confidence) from the last emotion pass
    last_log_time = 0.0

    # ── Watchdog state (self-healing for silently degraded detection) ──
    silent_cycles = 0          # consecutive cycles with 0 faces detected
    last_reinit_time = 0.0     # last time we reinitialized
    camera_black_count = 0     # consecutive near-black frames
    SILENT_CYCLES_THRESHOLD = 90  # ~30 seconds at 3 AI cycles/sec
    REINIT_COOLDOWN = 60.0      # minimum seconds between reinitializations
    while not stop_event.is_set():
        # Grab the newest frame + its sequence number (display thread replaces
        # the array reference per capture; it never mutates frames in place).
        with _cache_lock:
            frame = latest_frame
            seq = _frame_seq

        if frame is None or seq == last_seq:
            time.sleep(0.005)  # display thread hasn't captured yet
            continue
        last_seq = seq

        # ── Camera watchdog: a stream of near-black frames points at a camera
        # or driver problem, not a model problem — surface it loudly. ──
        frame_mean = np.mean(frame) if frame is not None else 0
        if frame_mean < 5.0:  # nearly pure black
            camera_black_count += 1
            if camera_black_count >= 30:  # ~30 consecutive black frames
                print("[WATCHDOG] Camera producing black frames — possible hardware issue", flush=True)
                camera_black_count = 0  # reset to avoid spam
        else:
            camera_black_count = 0

        frames_seen += 1
        if frames_seen % DETECT_EVERY_N != 0:
            continue

        enrolled_names, enrolled_embeddings, enrolled_uuids = db_holder[0]

        # ── InsightFace detection + ArcFace recognition ──
        results = []
        recognized_count = 0
        try:
            faces = app_holder[0].get(frame)
        except Exception as e:
            print(f"[AI] detection error: {e}", flush=True)
            continue

        for face in faces:
            det_score = face.det_score
            if det_score < 0.3:
                continue
            name, sim_score, student_uuid = match_face(
                face.embedding, enrolled_names, enrolled_embeddings,
                threshold=threshold, enrolled_uuids=enrolled_uuids
            )
            if name != UNKNOWN_LABEL:
                recognized_count += 1
            results.append({
                "name": name,
                "bbox": face.bbox,
                "similarity": sim_score,
                "student_uuid": student_uuid,
                "det_score": det_score,
                # Emotion fields default to None; filled from the face's
                # own crop classification below.
                "emotion": None,
                "engagement_state": None,
                "emotion_confidence": None,
            })

        # ── Detection watchdog: a long silent streak usually means the GPU
        # session degraded (DML sessions have been observed to stop detecting
        # after minutes of concurrent use). Reinitialize InsightFace in place;
        # app_holder is a mutable box so the swap persists for later cycles. ──
        if len(results) == 0:
            silent_cycles += 1
        else:
            silent_cycles = 0

        if (silent_cycles >= SILENT_CYCLES_THRESHOLD and
                time.time() - last_reinit_time > REINIT_COOLDOWN):
            print(f"[WATCHDOG] Detection silent for {silent_cycles} cycles — reinitializing InsightFace", flush=True)
            try:
                app_holder[0] = init_face_app(det_size=(640, 640))
                silent_cycles = 0
                last_reinit_time = time.time()
                print("[WATCHDOG] InsightFace reinitialized successfully", flush=True)
            except Exception as e:
                print(f"[WATCHDOG] Reinitialization failed: {e}", flush=True)
                # Keep trying — reset the cooldown so it retries sooner
                last_reinit_time = time.time() - REINIT_COOLDOWN + 30.0

        # ── Emotion inference (every EMOTION_INTERVAL seconds, same frame) ──
        # Each face is classified on its own padded crop; the per-face label
        # is carried forward between passes positionally (faces keep their
        # last emotion until the next pass rebuilds the list).
        now = time.time()
        if emotion_engine is not None and now - last_emotion_time >= EMOTION_INTERVAL:
            fresh_emotions = []
            for entry in results:
                face_crop = crop_face_with_padding(frame, entry["bbox"])
                try:
                    fresh_emotions.append(emotion_engine.classify_face(face_crop))
                except Exception as e:
                    print(f"[EMOTION] inference error: {e}", flush=True)
                    fresh_emotions.append(None)
            last_emotions = fresh_emotions
            last_emotion_time = now
        for idx, entry in enumerate(results):
            cached = last_emotions[idx] if idx < len(last_emotions) else None
            if cached is not None:
                emotion, conf = cached
                entry["emotion"] = emotion
                entry["emotion_confidence"] = conf
                entry["engagement_state"] = engagement_state_for(emotion)

        # ── 60-second sustained-absence map update ──
        # Every identity matched THIS pass refreshes its last_seen timestamp,
        # which is what both arms of the rule hang on: a face that keeps
        # matching never ages out, and a face that stops matching starts
        # aging immediately. No separate reset state is needed.
        for entry in results:
            if entry["name"] != UNKNOWN_LABEL:
                note_identity_seen(entry["name"], entry.get("student_uuid"),
                                   entry.get("emotion"))

        # ── Publish the new cache snapshot ──
        with _cache_lock:
            annotation_cache[:] = results

        if now - last_log_time >= 5.0:
            emotions = [r["emotion"] for r in results if r["emotion"]]
            print(f"[AI] Faces: {len(results)} | Recognized: {recognized_count} | "
                  f"Emotions: {emotions}", flush=True)
            last_log_time = now


# ── Visualization ─────────────────────────────────────────────────────────────

def draw_face_result(frame, entry):
    """Draw bounding box, name, and scores for one cached recognition result.

    Box color encodes engagement: green = attentive, red = disengaged,
    gray = no emotion attached (model missing or no crop classified yet).
    """
    bbox = np.asarray(entry["bbox"])
    x1, y1, x2, y2 = bbox.astype(int)

    name = entry["name"]
    score = entry["similarity"]
    det_score = entry["det_score"]
    emotion = entry.get("emotion")
    emotion_conf = entry.get("emotion_confidence")

    color = engagement_color(entry.get("engagement_state"))

    # Draw bounding box
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

    # Draw label background (name above the box, same pattern as before)
    label = f"{name}" if name != UNKNOWN_LABEL else "Unknown"
    label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
    cv2.rectangle(frame, (x1, y1 - label_size[1] - 10),
                  (x1 + label_size[0] + 10, y1), color, -1)
    cv2.putText(frame, label, (x1 + 5, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # Similarity score below box, with the emotion label next to it
    below = f"Sim: {score:.2f} | Det: {det_score:.2f}"
    if emotion:
        conf_text = f" ({emotion_conf:.2f})" if emotion_conf is not None else ""
        below += f" | {emotion}{conf_text}"
    cv2.putText(frame, below, (x1, y2 + 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)


def draw_hud(frame, fps, face_count, recognized_count, engaged_count,
             engaged_total):
    """Draw heads-up display with live stats (no desktop key hints).

    Engaged: P/Q where P = recognized faces currently 'attentive' and
    Q = recognized faces that have an emotion label at all.
    """
    h, w = frame.shape[:2]

    # Header bar
    cv2.rectangle(frame, (0, 0), (w, 40), COLORS["header_bg"], -1)

    hud_text = (f"PRISM-AI | FPS: {fps:.1f} | "
                f"Faces: {face_count} | "
                f"Recognized: {recognized_count} | "
                f"Engaged: {engaged_count}/{engaged_total}")
    cv2.putText(frame, hud_text, (10, 28),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLORS["info"], 1)
    # No key hints here: this frame is JPEG-encoded for the browser stream,
    # where the desktop-only 'q'/'d' keys do nothing. The console banner and
    # the debug window's waitKey loop still document/handle those keys.


# ── Display Thread (Thread 1, main) ───────────────────────────────────────────

def run_recognition(args):
    """Display thread: capture → draw cached annotations → JPEG → stream.

    All GPU inference (InsightFace + emotion) lives in ai_worker_loop so this
    loop keeps the camera at 25-30 fps regardless of model latency.
    """

    # Initialize InsightFace (GPU gate + models)
    app = init_face_app(det_size=(args.det_size, args.det_size))

    # Emotion engine — same providers as InsightFace; disabled with a warning
    # when the ONNX export is not on disk yet (recognition keeps working).
    emotion_engine = None
    try:
        emotion_engine = EmotionEngine(Path(args.emotion_model),
                                       gpu_check.require_gpu_providers())
    except FileNotFoundError as e:
        print(f"[EMOTION] Disabled: {e} (run the ONNX export to enable)")
    except Exception as e:
        print(f"[EMOTION] Disabled: failed to load model — {e}")

    # Load enrolled students; db_holder lets the 'r' hot-reload key swap the
    # tuple the AI worker reads without any lock (atomic rebinding).
    enrolled_names, enrolled_embeddings, enrolled_uuids = load_enrolled_students()
    db_holder = [(enrolled_names, enrolled_embeddings, enrolled_uuids)]

    # app_holder is a mutable box (same pattern as db_holder) so the AI
    # worker's watchdog can swap in a reinitialized InsightFace instance and
    # have the swap persist for later cycles.
    app_holder = [app]

    # Open camera
    camera_source = args.camera
    if camera_source.isdigit():
        camera_source = int(camera_source)

    # Use the DEFAULT backend (MSMF on modern Windows) — DirectShow (CAP_DSHOW)
    # can produce black frames after Windows restarts or driver updates, while
    # MSMF (the same backend the Windows Camera app uses) works reliably.
    # Only force CAP_DSHOW if MSMF fails to open the device.
    if isinstance(camera_source, int):
        cap = cv2.VideoCapture(camera_source)  # MSMF (default) — reliable
        if not cap.isOpened():
            cap = cv2.VideoCapture(camera_source, cv2.CAP_DSHOW)  # fallback
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
    stop_event = threading.Event()
    global latest_frame, _frame_seq  # published by this (display) thread

    print(f"\n{'='*60}")
    print(f"  PRISM-AI — Real-Time Face Recognition + Emotion")
    print(f"  Threshold: {args.threshold} | Camera: {args.camera}")
    print(f"  Enrolled students: {len(enrolled_names)}")
    print(f"  Detection every {DETECT_EVERY_N} frames | Emotion every "
          f"{EMOTION_INTERVAL:.0f}s")
    print(f"  Press 'q' to quit | 'd' to toggle debug view")
    print(f"{'='*60}\n")

    # Boot the MJPEG stream server so the React dashboard can render frames in
    # a <img src="/stream"> tag. The server reads _latest_jpeg, which this
    # display loop refreshes after annotating each frame.
    start_stream_server(port=args.stream_port)

    # Boot the AI worker (Thread 2) — daemon so Ctrl+C still exits.
    ai_thread = threading.Thread(
        target=ai_worker_loop,
        args=(app_holder, emotion_engine, db_holder, args.threshold, stop_event),
        daemon=True,
        name="prism-ai-worker",
    )
    ai_thread.start()

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                if isinstance(camera_source, str):
                    print("[INFO] Video ended.")
                    break
                print("[ERROR] Failed to read frame")
                continue

            # Publish the raw frame for the AI worker (reference swap under
            # the shared lock — no copy, the lock is held for microseconds).
            with _cache_lock:
                latest_frame = frame
                _frame_seq += 1

            # Snapshot the latest recognition results (quick copy under lock;
            # entries are immutable after publication).
            with _cache_lock:
                results = list(annotation_cache)

            # ── Visualization (cached boxes only — never blocks on GPU) ──
            display = frame.copy()
            recognized_count = 0
            engaged_count = 0
            engaged_total = 0
            for entry in results:
                if entry["name"] != UNKNOWN_LABEL:
                    recognized_count += 1
                    emotion = entry.get("emotion")
                    if emotion:
                        engaged_total += 1
                        if entry.get("engagement_state") == "attentive":
                            engaged_count += 1
                draw_face_result(display, entry)

            draw_hud(display, fps, len(results), recognized_count,
                     engaged_count, engaged_total)

            if show_debug:
                cv2.imshow("PRISM-AI Face Recognition", display)

            # Push the annotated frame to the MJPEG stream. JPEG quality 80
            # keeps the wire size sane (~30-60 KB/frame at 640x480). Any
            # encoder error is swallowed — we never let streaming crash the
            # display loop.
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
                        # Name and class from "Name (Class)" format via the
                        # same helper the synthetic absence rows use.
                        student_name, student_class = split_display_name(r["name"])

                        emotion_conf = r.get("emotion_confidence")
                        recognized_students.append({
                            "student_name": student_name,
                            "student_class": student_class,
                            "student_year": 1,
                            # Exact-match attendance: Supabase UUID from the
                            # enrollment record (null → server falls back to
                            # name matching for old data).
                            "student_uuid": r.get("student_uuid"),
                            "similarity_score": round(float(r["similarity"]), 4),
                            "status": "Present",
                            # Emotion-engine additions (null when no emotion
                            # label is attached to this face right now).
                            "emotion": r.get("emotion"),
                            "engagement_state": r.get("engagement_state"),
                            "emotion_confidence": (
                                round(float(emotion_conf), 4)
                                if emotion_conf is not None else None
                            ),
                        })

                # ── 60-second sustained-absence rows (payload-only) ──
                # Snapshot the last-seen map under its lock (entries copied),
                # then let the pure builder decide who has been gone for
                # ABSENCE_SYNTHETIC_THRESHOLD continuous seconds. These rows
                # never touch annotation_cache, so the display overlay and
                # the MJPEG stream cannot show absent identities.
                with _absence_lock:
                    seen_snapshot = {k: dict(v) for k, v in _last_seen_map.items()}
                absent_rows = build_absent_rows(seen_snapshot, time.monotonic())

                payload_rows = recognized_students + absent_rows
                if payload_rows:
                    send_to_dashboard(payload_rows)
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

            # ── Key handling ──
            if show_debug:
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break
                elif key == ord('d'):
                    show_debug = not show_debug
                elif key == ord('r'):
                    # Reload enrolled students (hot-reload); the AI worker
                    # picks the new tuple up on its next cycle.
                    print("[INFO] Reloading enrolled students...")
                    db_holder[0] = load_enrolled_students()
            else:
                # Even without debug window, check for keyboard interrupt
                # Add a minimal waitKey for non-debug mode
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

    except KeyboardInterrupt:
        print("\n[INFO] Interrupted by user.")

    finally:
        stop_event.set()
        ai_thread.join(timeout=3.0)
        cap.release()
        cv2.destroyAllWindows()
        print("[INFO] Camera released. Goodbye!")

    # ── PRIVACY GUARANTEE ──
    # No frames, images, or face crops were saved to disk.
    # Only 512-d mathematical vectors were processed in RAM.


# ── Entry Point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="PRISM-AI — Real-Time Face Recognition + Emotion (Edge Service)"
    )
    parser.add_argument("--camera", type=str, default="0",
                        help="Camera index or video file path (default: 0)")
    parser.add_argument("--threshold", type=float, default=0.4,
                        help="Cosine similarity threshold for matching (default: 0.4)")
    parser.add_argument("--debug", action="store_true",
                        help="Show debug visualization window")
    parser.add_argument("--det-size", type=int, default=320,
                        help="Face detection input size (default: 320)")
    parser.add_argument("--stream-port", type=int, default=5174,
                        help="Port for the MJPEG live-stream HTTP server (default: 5174)")
    parser.add_argument("--emotion-model", type=str, default=str(EMOTION_MODEL_PATH),
                        help="Path to the YOLOv8 emotion ONNX model "
                             "(default: best_v2.onnx next to this script)")

    args = parser.parse_args()
    run_recognition(args)


if __name__ == "__main__":
    main()
