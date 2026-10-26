"""
PRISM-AI Edge Service: Headless Enrollment Helper (in-browser capture).

Replaces the desktop OpenCV window of enroll_student.py when enrollment is
driven from the browser: the ADMIN'S OWN browser grabs JPEG frames from the
local camera and Express forwards them here. This helper NEVER opens a
camera itself: there is no cv2.VideoCapture call anywhere in this file, by
design, not by omission.

Wire protocol with the spawner (Express):
  - stdout, after the models load and the HTTP socket is bound:
        ENROLL_READY port=<port>
    This is the ONLY readiness signal; with --port 0 the bound port is only
    knowable from this line.
  - GPU gate: identical to enroll_student.py. On a machine without a GPU
    execution provider, gpu_check prints the GPU_REQUIRED marker to stderr
    and the process exits with code 3 (see the gpu_check.py docstring for
    the exact wire contract with server.js).

Privacy stance (same as enroll_student.py): frames exist in RAM only. This
process never writes an image anywhere; only the averaged 512-d embedding
leaves this process, handed back over HTTP. Express (a separate package)
owns writing enrolled_students.json; this helper never touches that file.

Usage:
    py enroll_server.py --port 0 [--idle-timeout 600] [--det-size 640]
"""

import argparse
import base64
import json
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2
import numpy as np

import gpu_check

# Force UTF-8 on stdout/stderr so the ENROLL_READY line and INIT logs survive
# being spawned by Node.js / Express on Windows (the default cp1252 codepage
# cannot encode the characters our console output uses). Same pattern as
# face_recognition.py and gpu_check.py.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass  # older Pythons or unusual stream types; best effort

REQUIRED_CAPTURES = 5          # same sample count enroll_student.py averages
MIN_DET_SCORE = 0.5            # same quality gate as enroll_student.py's 'c' key
CAPTURE_DEDUPE_SECONDS = 0.5   # double-click guard between banked captures


class EnrollSession:
    """One in-memory enrollment session (one helper process per enrollment).

    Everything lives here in RAM only: frames are decoded, evaluated, and
    dropped; only 512-d embeddings are retained until /finalize averages
    them. Nothing in this class is ever written to disk.
    """

    def __init__(self):
        # Serializes InsightFace inference AND banking: FaceAnalysis is not
        # thread-safe, and the dedupe timestamp must move in the same step
        # as the append or two racing captures could both pass the guard.
        self.lock = threading.Lock()
        self.embeddings = []            # banked 512-d vectors, capture order preserved
        self.last_bank_monotonic = 0.0  # time.monotonic() of the last banked capture

    @property
    def captures(self):
        return len(self.embeddings)


session = EnrollSession()
_app = None                     # FaceAnalysis instance, created once in main()
_server = None                  # ThreadingHTTPServer, created once in main()

# Idle-watchdog clock. Initialized at import (not left at 0.0) so the first
# comparison in _idle_watchdog measures from process start, not from 1970.
_last_request_monotonic = time.monotonic()


def init_face_app(det_size=(640, 640)):
    """Initialize InsightFace FaceAnalysis on a GPU execution provider.

    Same gate as enroll_student.py: require_gpu_providers() refuses with the
    GPU_REQUIRED marker and exit code 3 before any model loads, and
    effective_det_size() pins DirectML to the 640x640 it can actually run.
    """
    from insightface.app import FaceAnalysis

    providers = gpu_check.require_gpu_providers()
    det_size = gpu_check.effective_det_size(providers, det_size)

    print("[INIT] Loading InsightFace models (SCRFD + ArcFace)...")
    print("[INIT] This may take a moment on first run (downloading models)...")

    app = FaceAnalysis(
        name="buffalo_l",
        providers=providers,
        # Only bbox/kps/det_score/embedding are needed here; skipping the
        # genderage/landmark models matches face_recognition.py and
        # enroll_student.py and shortens load time.
        allowed_modules=["detection", "recognition"],
    )
    app.prepare(ctx_id=0, det_size=det_size)

    active = gpu_check.verify_gpu_active(app)
    print(f"[INIT] GPU inference active: {', '.join(sorted(active))}")
    print(f"[INIT] Models loaded. Detection size: {det_size}")
    return app


def _bbox_xywh(bbox):
    """InsightFace bboxes are [x1, y1, x2, y2]; the UI wants [x, y, w, h]."""
    x1, y1, x2, y2 = bbox.astype(int)
    return [int(x1), int(y1), int(x2 - x1), int(y2 - y1)]


def _schedule_stop(delay=0.0):
    """Stop the accept loop after an optional delay, from a throwaway thread.

    The delay exists for the /shutdown response: it must reach the socket
    before serve_forever() stops. serve_forever returning lets main() fall
    through to a normal exit with code 0 (no os._exit anywhere).
    """
    def _stop():
        if delay > 0:
            time.sleep(delay)
        _server.shutdown()
    threading.Thread(target=_stop, daemon=True).start()


def _idle_watchdog(idle_timeout):
    """Exit the process cleanly after idle_timeout seconds without a request.

    Express can lose track of a helper (crash, restart, forgotten child);
    the watchdog keeps an orphaned GPU-model process from lingering forever.
    """
    if idle_timeout <= 0:
        return  # 0 (or negative) disables the watchdog
    while True:
        time.sleep(1)
        if time.monotonic() - _last_request_monotonic >= idle_timeout:
            print(f"[INFO] No requests for {idle_timeout}s, shutting down.",
                  flush=True)
            _schedule_stop()
            return


class EnrollHandler(BaseHTTPRequestHandler):
    """HTTP surface for the browser-driven enrollment flow (via Express)."""

    # ── plumbing ─────────────────────────────────────────────────────────

    def _touch(self):
        """Any accepted request resets the idle watchdog."""
        global _last_request_monotonic
        _last_request_monotonic = time.monotonic()

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass  # caller hung up before reading; nothing to salvage
        self._responded = True

    def _read_json_body(self):
        length = int(self.headers.get('Content-Length') or 0)
        raw = self.rfile.read(length) if length > 0 else b'{}'
        return json.loads(raw.decode('utf-8'))

    def _fail(self, exc):
        # A bad frame or a bug must never take the server thread down: the
        # full trace goes to stderr for the human, the caller gets a
        # machine-readable 500 instead of a dropped connection.
        traceback.print_exc(file=sys.stderr)
        if not getattr(self, '_responded', False):
            self._send_json(500, {"error": str(exc)})

    def log_message(self, format, *args):  # noqa: A002; match base class
        return  # silence access logs, same as face_recognition.py

    # ── routes ───────────────────────────────────────────────────────────

    def do_GET(self):
        try:
            self._touch()
            if self.path == '/health':
                self._send_json(200, {
                    "ready": True,
                    "captures": session.captures,
                    "required": REQUIRED_CAPTURES,
                })
            else:
                self._send_json(404, {"error": f"unknown path: {self.path}"})
        except Exception as exc:
            self._fail(exc)

    def do_POST(self):
        try:
            self._touch()
            if self.path == '/frame':
                self._handle_frame()
            elif self.path == '/finalize':
                self._handle_finalize()
            elif self.path == '/shutdown':
                self._handle_shutdown()
            else:
                self._send_json(404, {"error": f"unknown path: {self.path}"})
        except Exception as exc:
            self._fail(exc)

    # ── endpoint bodies ──────────────────────────────────────────────────

    def _handle_frame(self):
        body = self._read_json_body()
        image_b64 = body.get('image_b64') or ''
        mode = body.get('mode') or 'preview'

        # Browsers often prefix base64 payloads with a data URL
        # ("data:image/jpeg;base64,...."); strip it before decoding.
        if isinstance(image_b64, str) and image_b64.startswith('data:'):
            image_b64 = image_b64.split(',', 1)[-1]

        jpeg_bytes = base64.b64decode(image_b64)
        # PRIVACY: the decoded frame lives only in this local variable and is
        # dropped when this handler returns; nothing is ever written to disk.
        frame = cv2.imdecode(np.frombuffer(jpeg_bytes, np.uint8), cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError('image_b64 did not decode to an image')

        with session.lock:
            faces = _app.get(frame)
            count = len(faces)

            if count == 0:
                verdict, det_score, bbox = 'no_face', None, None
            elif count > 1:
                verdict = 'multiple'
                # With several faces there is no single subject; reporting the
                # strongest detection still gives the UI a confidence number
                # and a box to draw while it asks the user to step aside.
                best = max(faces, key=lambda f: float(f.det_score))
                det_score = float(best.det_score)
                bbox = _bbox_xywh(best.bbox)
            else:
                face = faces[0]
                det_score = float(face.det_score)
                bbox = _bbox_xywh(face.bbox)
                verdict = 'ok' if det_score >= MIN_DET_SCORE else 'low_confidence'

            if mode == 'capture' and verdict == 'ok':
                now = time.monotonic()
                # A capture landing < 0.5s after the previous bank is treated
                # as preview (dedupe for double-clicks): the browser fires
                # two POSTs with the same pose, and banking both would weight
                # one instant twice in the averaged embedding.
                if now - session.last_bank_monotonic >= CAPTURE_DEDUPE_SECONDS:
                    session.embeddings.append(face.embedding)  # 512-d, RAM only
                    session.last_bank_monotonic = now

            captures = session.captures

        self._send_json(200, {
            "faces": count,
            "det_score": det_score,
            "bbox": bbox,
            "verdict": verdict,
            "captures": captures,
            "required": REQUIRED_CAPTURES,
            "done": captures >= REQUIRED_CAPTURES,
        })

    def _handle_finalize(self):
        with session.lock:
            captures = session.captures
            if captures < REQUIRED_CAPTURES:
                self._send_json(409, {
                    "error": f"not enough captures yet: {captures}/{REQUIRED_CAPTURES}",
                    "captures": captures,
                    "required": REQUIRED_CAPTURES,
                })
                return

            # Same math as the tail of enroll_student.py's capture_embeddings:
            # average the samples for robustness, then normalize to unit
            # length so recognition can compare embeddings by cosine.
            avg_embedding = np.mean(session.embeddings, axis=0)
            norm = np.linalg.norm(avg_embedding)
            if norm > 0:
                avg_embedding = avg_embedding / norm

        self._send_json(200, {
            "embedding": [float(x) for x in avg_embedding],
            "captures": captures,
        })
        # Deliberately no exit here: Express calls /shutdown when it is done,
        # and until then /health can still report the final captures count.

    def _handle_shutdown(self):
        self._send_json(200, {"bye": True})
        _schedule_stop(delay=0.2)  # let the response flush before the accept loop stops


def main():
    global _app, _server

    parser = argparse.ArgumentParser(
        description="PRISM-AI headless enrollment helper (browser-driven capture)"
    )
    parser.add_argument("--port", type=int, default=0,
                        help="TCP port to bind on 127.0.0.1 (0 = pick a free "
                             "port; the chosen port is reported in the "
                             "ENROLL_READY line)")
    parser.add_argument("--idle-timeout", type=float, default=600,
                        help="exit with code 0 after this many seconds with "
                             "no request (0 disables the watchdog)")
    parser.add_argument("--det-size", type=int, default=640,
                        help="detector input size (default 640; gpu_check "
                             "forces 640 on DirectML)")
    args = parser.parse_args()

    # Load the models exactly once, BEFORE binding the socket: the GPU gate
    # must be able to refuse (exit 3) without ever announcing readiness.
    _app = init_face_app(det_size=(args.det_size, args.det_size))

    _server = ThreadingHTTPServer(("127.0.0.1", args.port), EnrollHandler)
    # Each request gets its own thread (a slow client must not block others),
    # and those threads must never keep the process alive on shutdown; this
    # matters because the React auto-retry can open many rapid connections.
    _server.daemon_threads = True

    threading.Thread(target=_idle_watchdog, args=(args.idle_timeout,),
                     daemon=True).start()

    chosen_port = _server.server_address[1]
    # The ONE readiness signal for the spawner (Express): wait for exactly
    # this line and read the bound port from it (vital with --port 0).
    print(f"ENROLL_READY port={chosen_port}", flush=True)

    try:
        _server.serve_forever()  # returns when _schedule_stop fires
    except KeyboardInterrupt:
        pass  # manual Ctrl+C run: fall through to a clean exit
    finally:
        _server.server_close()

    print("[INFO] Enrollment helper stopped.", flush=True)


if __name__ == "__main__":
    main()
