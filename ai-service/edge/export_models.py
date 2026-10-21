#!/usr/bin/env python3
"""One-time setup: export the YOLOv8 emotion model to ONNX and sanity-check both ONNX models.

This script is a ONE-TIME conversion step. It is NOT part of the runtime pipeline and
does not need to be run again once ai-service/edge/best_v2.onnx exists.

Why the ugly subprocess dance?
    The ai-service edge venv intentionally ships without ultralytics and torch (a large
    install that only ONNX inference is meant to avoid). Converting best_v2.pt to ONNX
    however needs ultralytics+torch, so this script shells out to the `yolo` CLI if it
    can be found anywhere on this machine, and otherwise prints the exact manual
    commands. The exported best_v2.onnx has NO runtime dependency on torch; after this
    runs once, the venv can stay lean.

Manual export (only needed if the script cannot find a `yolo` executable):
    In any temporary environment with ultralytics+torch (e.g. the training machine):
        pip install ultralytics
        yolo export model="C:/Users/Guess/Documents/unikl/SEM 6/IPB49906 - FINAL YEAR PROJECT 2/PROJECT/ai-service/edge/best_v2.pt" format=onnx imgsz=640
    Ultralytics writes best_v2.onnx next to the source .pt file. Then re-run this
    script to verify the export.

Verified facts baked into this file (extracted directly from the best_v2.pt
checkpoint pickle, without torch):
    The model has 10 emotion classes (NOT 6 as earlier assumed):
        {0: 'Angry', 1: 'Disgust', 2: 'Excited', 3: 'Fear', 4: 'Happy', 5: 'Sad',
         6: 'Serious', 7: 'Thinking', 8: 'Worried', 9: 'neutral'}
    (note the casing: only 'neutral' is lowercase). A ultralytics ONNX export embeds
    this dict in the model metadata under the 'names' key, so at runtime prefer
    metadata and use the list below only as a fallback.

Usage (inside ai-service/edge/venv):
    python export_models.py
"""

from __future__ import annotations

import ast
import shutil
import subprocess
import sys
from pathlib import Path

EDGE_DIR = Path(__file__).resolve().parent
PT_PATH = EDGE_DIR / "best_v2.pt"
ONNX_PATH = EDGE_DIR / "best_v2.onnx"
IMG_SIZE = 640

# Ground-truth labels extracted from the best_v2.pt checkpoint (see module docstring).
FALLBACK_CLASS_NAMES = [
    "Angry", "Disgust", "Excited", "Fear", "Happy",
    "Sad", "Serious", "Thinking", "Worried", "neutral",
]

# det_10g.onnx (SCRFD from the buffalo_l pack) is cached by InsightFace outside the
# repo; face_recognition.py loads it via FaceAnalysis(name="buffalo_l").
DET_ONNX_CANDIDATES = [
    EDGE_DIR / "det_10g.onnx",
    Path.home() / ".insightface" / "models" / "buffalo_l" / "det_10g.onnx",
]


def venv_yolo_candidates() -> list[Path]:
    scripts = EDGE_DIR / "venv" / "Scripts"  # Windows venv layout
    bin_ = EDGE_DIR / "venv" / "bin"  # POSIX venv layout
    return [scripts / "yolo.exe", bin_ / "yolo"]


def find_yolo() -> str | None:
    """Return a runnable `yolo` CLI path: PATH first, then the edge venv."""
    found = shutil.which("yolo")
    if found:
        return found
    for cand in venv_yolo_candidates():
        if cand.is_file():
            return str(cand)
    return None


def export_best_v2() -> bool:
    """Export best_v2.pt to ONNX via the ultralytics CLI. True iff the ONNX exists."""
    if ONNX_PATH.is_file():
        print(f"[SKIP] {ONNX_PATH.name} already exists, skipping export.")
        return True
    if not PT_PATH.is_file():
        print(f"[FAIL] Source model not found: {PT_PATH}")
        return False

    yolo = find_yolo()
    if yolo is None:
        print("[MANUAL] No `yolo` executable found on PATH or in the edge venv.")
        print("         Ultralytics+torch are required for this ONE-TIME export only.")
        print("         Run in any temporary environment:")
        print("             pip install ultralytics")
        print(f'             yolo export model="{PT_PATH}" format=onnx imgsz={IMG_SIZE}')
        print(f"         It writes best_v2.onnx next to best_v2.pt; then re-run this script.")
        return False

    cmd = [yolo, "export", f"model={PT_PATH}", "format=onnx", f"imgsz={IMG_SIZE}"]
    print(f"[RUN ] {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(EDGE_DIR))
    if result.returncode != 0:
        print(f"[FAIL] yolo export exited with code {result.returncode}")
        return False
    if not ONNX_PATH.is_file():
        print(f"[FAIL] Export reported success but {ONNX_PATH} does not exist.")
        return False
    print(f"[OK  ] Exported {ONNX_PATH}")
    return True


def session_summary(session) -> list[str]:
    """Human-readable input/output names, shapes and dtypes for an onnxruntime session."""
    lines = []
    for io_name, items in (("input", session.get_inputs()), ("output", session.get_outputs())):
        for item in items:
            lines.append(f"    {io_name}: name={item.name!r} shape={list(item.shape)} dtype={item.type}")
    return lines


def class_names_from_metadata(session) -> list[str] | None:
    """Read the ultralytics 'names' metadata dict from an exported model, if present."""
    meta = session.get_modelmeta().custom_metadata_map
    raw = meta.get("names")
    if not raw:
        return None
    try:
        names_map = ast.literal_eval(raw)
        return [str(names_map[k]) for k in sorted(names_map, key=lambda k: int(k))]
    except (ValueError, TypeError, KeyError, AttributeError):
        print(f"[WARN] Could not parse 'names' metadata: {raw!r}")
        return None


def verify_best_v2(findings: dict) -> bool:
    """Load best_v2.onnx with onnxruntime and report shapes and class names."""
    if not ONNX_PATH.is_file():
        print(f"[WARN] {ONNX_PATH.name} not present yet, skipping its verification.")
        return False
    try:
        import onnxruntime as ort
    except ImportError:
        print("[FAIL] onnxruntime not importable in this interpreter.")
        return False

    print(f"[OK  ] Loading emotion model with onnxruntime {ort.__version__}: {ONNX_PATH}")
    session = ort.InferenceSession(str(ONNX_PATH), providers=["CPUExecutionProvider"])
    for line in session_summary(session):
        print(line)

    names = class_names_from_metadata(session)
    source = "metadata"
    if names is None:
        names, source = list(FALLBACK_CLASS_NAMES), "hardcoded fallback (no metadata)"
        print("[WARN] No 'names' metadata in the ONNX; using the hardcoded fallback list.")
    print(f"[OK  ] Class names ({source}), {len(names)} classes: {names}")
    if len(names) != 6:
        print(f"[NOTE] Task spec mentioned 6 classes but the model defines {len(names)} "
              f"(extracted from best_v2.pt itself, see module docstring).")

    out_shape = session.get_outputs()[0].shape
    if isinstance(out_shape[1], int):
        derived_nc = out_shape[1] - 4  # YOLOv8 detect head: [batch, 4 + nc, anchors]
        print(f"[OK  ] Derived class count from output shape {list(out_shape)}: nc={derived_nc}")
        findings["derived_nc_from_output_shape"] = derived_nc
        if derived_nc != len(names):
            print(f"[WARN] nc={derived_nc} disagrees with {len(names)} class names.")
    else:
        print(f"[NOTE] Output dim 1 is dynamic ({out_shape[1]!r}); cannot derive nc from shape.")

    findings["emotion_inputs"] = [f"{i.name} {list(i.shape)} {i.type}" for i in session.get_inputs()]
    findings["emotion_outputs"] = [f"{o.name} {list(o.shape)} {o.type}" for o in session.get_outputs()]
    findings["emotion_class_names"] = names
    findings["emotion_class_source"] = source
    return True


def verify_det_10g(findings: dict) -> bool:
    """Sanity check: the SCRFD det_10g.onnx from buffalo_l loads and looks right."""
    det_path = next((p for p in DET_ONNX_CANDIDATES if p.is_file()), None)
    if det_path is None:
        print(f"[FAIL] det_10g.onnx not found in: {[str(p) for p in DET_ONNX_CANDIDATES]}")
        return False
    try:
        import onnxruntime as ort
    except ImportError:
        print("[FAIL] onnxruntime not importable in this interpreter.")
        return False

    print(f"[OK  ] Loading SCRFD det_10g.onnx (buffalo_l) with onnxruntime {ort.__version__}: {det_path}")
    session = ort.InferenceSession(str(det_path), providers=["CPUExecutionProvider"])
    for line in session_summary(session):
        print(line)

    inputs = session.get_inputs()
    ok = len(inputs) == 1 and len(inputs[0].shape) == 4 and inputs[0].shape[1] == 3
    print("[OK  ] SCRFD sanity: single NCHW 3-channel input." if ok
          else "[FAIL] SCRFD sanity: unexpected input signature.")
    findings["det_10g_path"] = str(det_path)
    findings["det_10g_inputs"] = [f"{i.name} {list(i.shape)} {i.type}" for i in inputs]
    findings["det_10g_outputs"] = [f"{o.name} {list(o.shape)} {o.type}" for o in session.get_outputs()]
    return ok


def main() -> int:
    findings: dict = {}
    exported = export_best_v2()
    best_v2_ok = verify_best_v2(findings)
    det_ok = verify_det_10g(findings)

    print("\n===== FINDINGS =====")
    print(f"best_v2.pt            : {PT_PATH}")
    print(f"best_v2.onnx          : {ONNX_PATH} ({'present' if ONNX_PATH.is_file() else 'NOT EXPORTED YET'})")
    for key, value in findings.items():
        print(f"{key.ljust(22)}: {value}")
    print("====================")

    if not det_ok:
        return 1
    if not best_v2_ok:
        # Export impossible or model missing: the printed MANUAL block explains what to do.
        return 0 if not exported and find_yolo() is None else 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
