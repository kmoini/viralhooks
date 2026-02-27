"""
Animation runner — the single file you swap to change the model.

Current mode: DEMO
  Simply copies the driver video to the output path so the full
  Node → Python → mp4 pipeline can be tested end-to-end.

To enable REAL mode:
  Replace the body of `animate()` with your reenactment model call.
  Recommended: LivePortrait (https://github.com/KwaiVGI/LivePortrait)

  Example integration (pseudocode):
  ─────────────────────────────────────────────────────
  from live_portrait import LivePortraitPipeline

  pipeline = LivePortraitPipeline(device="cuda")

  def animate(source_image_path, driver_video_path, output_path):
      pipeline.run(
          source=source_image_path,
          driver=driver_video_path,
          output=output_path,
      )
      return output_path
  ─────────────────────────────────────────────────────
"""

import os
import shutil

# ── Set this to "real" once a model is installed ──
MODE = os.environ.get("ANIMATOR_MODE", "demo")


def animate(
    source_image_path: str,
    driver_video_path: str,
    output_path: str,
) -> str:
    """
    Generate an animated video from a source image and driver video.

    Args:
        source_image_path: Path to user's uploaded photo.
        driver_video_path: Path to the dance driver clip.
        output_path:       Where to write the final mp4.

    Returns:
        Path to the output mp4 file.
    """

    if MODE == "real":
        # ────────────────────────────────────────────────────────
        # ▶ REPLACE THIS BLOCK WITH YOUR REAL MODEL CALL
        #
        # The model should:
        #   1. Read the source image (face/identity to preserve)
        #   2. Read the driver video (motion to transfer)
        #   3. Produce an output mp4 at `output_path`
        #      with the source identity animated by the driver motion.
        #
        # LivePortrait example:
        #   from live_portrait import LivePortraitPipeline
        #   pipeline = LivePortraitPipeline(device="cuda")
        #   pipeline.run(source=source_image_path,
        #                driver=driver_video_path,
        #                output=output_path)
        #
        # ────────────────────────────────────────────────────────
        raise NotImplementedError(
            "Real model not yet installed. "
            "Implement the reenactment call in runner.py or set ANIMATOR_MODE=demo."
        )

    # ── DEMO MODE: copy driver video as output ──
    print(f"[DEMO] Copying driver video as output: {driver_video_path} -> {output_path}")
    shutil.copy2(driver_video_path, output_path)
    return output_path
