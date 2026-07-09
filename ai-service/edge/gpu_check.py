"""
PRISM-AI Edge Service — GPU gate (no CPU fallback)

The edge AI must run on GPU inference (NVIDIA CUDA or DirectML). On machines
without a supported GPU the service refuses to start instead of silently
degrading to CPU frame rates. The web app itself runs anywhere — this gate
applies only to the camera machine.

Wire protocol with server.js:
  - the refusal line on stderr carries the marker  GPU_REQUIRED
  - the refusal exit code is 3 (EXIT_GPU_REQUIRED)
server.js maps either signal to the "Incompatible hardware — GPU required"
banner on the Camera page — keep marker, exit code and message in sync.
"""

import sys

# cp1252 crash guard for the em-dash in the refusal message when the scripts
# are run by hand (Express already spawns them with PYTHONIOENCODING=utf-8).
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

GPU_PROVIDERS = ("CUDAExecutionProvider", "DmlExecutionProvider")
GPU_REQUIRED_MSG = "Incompatible hardware — GPU required"
EXIT_GPU_REQUIRED = 3

_INSTALL_HINT = (
    "install onnxruntime-directml (Windows, any DirectX 12 GPU) "
    "or onnxruntime-gpu (NVIDIA CUDA)"
)


def _refuse(detail):
    print(f"[FATAL] GPU_REQUIRED: {GPU_REQUIRED_MSG} ({detail})",
          file=sys.stderr, flush=True)
    sys.exit(EXIT_GPU_REQUIRED)


def require_gpu_providers():
    """Exit(3) unless a GPU execution provider is available; otherwise return
    the provider list to pass to FaceAnalysis.

    CPUExecutionProvider is kept LAST in the list: onnxruntime uses it only
    for the few ops a GPU provider does not implement (graph partitioning),
    never as the primary engine — verify_gpu_active() enforces that after the
    models load.
    """
    try:
        import onnxruntime as ort
    except ImportError:
        # A missing package is a broken venv, not incompatible hardware —
        # exit 1 (not 3) so the hardware banner is not shown for it.
        print(f"[FATAL] onnxruntime is missing from the venv; {_INSTALL_HINT}",
              file=sys.stderr, flush=True)
        sys.exit(1)

    available = ort.get_available_providers()
    wanted = [p for p in GPU_PROVIDERS if p in available]
    if not wanted:
        _refuse(
            f"no CUDA/DirectML execution provider in onnxruntime "
            f"{ort.__version__} (available: {available}); {_INSTALL_HINT}"
        )
    return wanted + ["CPUExecutionProvider"]


def effective_det_size(providers, det_size):
    """Clamp the detector input size to what the active GPU provider can run.

    DirectML fails SCRFD's dynamic-shape graph at sizes other than its
    authored 640x640 (Reshape_223 aborts with 80070057 "the parameter is
    incorrect" — verified at 320 on both adapters of a hybrid laptop), so
    force 640 there. CUDA runs arbitrary sizes; the requested size stands.
    """
    lead = providers[0] if providers else ""
    size = (det_size[0], det_size[1])
    if lead == "DmlExecutionProvider" and size != (640, 640):
        print(f"[INIT] DirectML only supports det-size 640x640 — overriding requested {size}",
              flush=True)
        return (640, 640)
    return size


def verify_gpu_active(app):
    """Exit(3) unless every loaded InsightFace model session runs on a GPU
    provider; otherwise return the set of active GPU providers for logging.

    Needed because onnxruntime silently falls back to CPU when a requested
    provider fails to initialize (e.g. a broken driver) — nothing raises, so
    only the sessions themselves can prove where inference actually runs.
    """
    active = set()
    for task, model in getattr(app, "models", {}).items():
        session = getattr(model, "session", None)
        if session is None:
            continue
        providers = session.get_providers()
        primary = providers[0] if providers else "none"
        if primary not in GPU_PROVIDERS:
            _refuse(f"model '{task}' initialized on {primary} instead of a GPU provider")
        active.add(primary)
    if not active:
        _refuse("no model sessions found to verify GPU placement")
    return active
