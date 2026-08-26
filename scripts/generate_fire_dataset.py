"""Generates annotated training/validation images and YOLO label pairs for fire and flame detection."""

from __future__ import annotations
import os
import random
from pathlib import Path
import numpy as np
import cv2


def generate_fire_dataset(root_dir: str = "datasets/fire_smoke", num_train: int = 20, num_val: int = 6) -> None:
    """Generate annotated synthetic and flame training data for YOLO fire detection."""
    root = Path(root_dir)
    train_img_dir = root / "images" / "train"
    val_img_dir = root / "images" / "val"
    train_lbl_dir = root / "labels" / "train"
    val_lbl_dir = root / "labels" / "val"

    for d in [train_img_dir, val_img_dir, train_lbl_dir, val_lbl_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # data.yaml
    yaml_content = f"""path: {root.resolve().as_posix()}
train: images/train
val: images/val

names:
  0: fire
  1: smoke
"""
    with open(root / "data.yaml", "w", encoding="utf-8") as f:
        f.write(yaml_content)

    def create_fire_scene(split: str, index: int) -> None:
        width, height = 640, 480
        # Background
        bg_darkness = 20 + (index * 4) % 30
        img = np.full((height, width, 3), (bg_darkness, bg_darkness + 2, bg_darkness + 5), dtype=np.uint8)

        # Ground or table
        cv2.rectangle(img, (0, 360), (width, height), (35, 38, 42), -1)

        # Fire location
        fx = 180 + ((index * 37) % 280)
        fy = 240 + ((index * 23) % 100)
        fw = 35 + (index % 5) * 8
        fh = 55 + (index % 4) * 12

        # Draw flame layers (radiant glow, orange core, bright yellow center)
        # Outer radiant red glow
        cv2.ellipse(img, (fx, fy), (fw + 18, fh + 15), 0, 0, 360, (0, 40, 220), -1)
        # Mid orange flame
        cv2.ellipse(img, (fx, fy - 5), (fw + 5, fh), 0, 0, 360, (0, 140, 255), -1)
        # Inner bright yellow/white core
        cv2.ellipse(img, (fx, fy + 8), (fw - 12, fh - 20), 0, 0, 360, (120, 240, 255), -1)

        # Draw smoke plume above flame
        sx = fx + ((index * 5) % 20) - 10
        sy = fy - fh - 35
        sw = fw + 20
        sh = 40
        cv2.ellipse(img, (sx, sy), (sw, sh), 0, 0, 360, (90, 90, 95), -1)
        cv2.ellipse(img, (sx + 5, sy - 30), (sw + 15, sh + 10), 0, 0, 360, (75, 75, 80), -1)

        # Bounding box for fire (Class 0: fire)
        min_fx = max(0, fx - fw - 10)
        max_fx = min(width, fx + fw + 10)
        min_fy = max(0, fy - fh - 10)
        max_fy = min(height, fy + fh + 10)

        box_fw = (max_fx - min_fx) / width
        box_fh = (max_fy - min_fy) / height
        box_fcx = ((min_fx + max_fx) / 2) / width
        box_fcy = ((min_fy + max_fy) / 2) / height

        # Bounding box for smoke (Class 1: smoke)
        min_sx = max(0, sx - sw - 10)
        max_sx = min(width, sx + sw + 10)
        min_sy = max(0, sy - sh - 35)
        max_sy = min(height, sy + sh + 5)

        box_sw = (max_sx - min_sx) / width
        box_sh = (max_sy - min_sy) / height
        box_scx = ((min_sx + max_sx) / 2) / width
        box_scy = ((min_sy + max_sy) / 2) / height

        labels = [
            f"0 {box_fcx:.6f} {box_fcy:.6f} {box_fw:.6f} {box_fh:.6f}",
            f"1 {box_scx:.6f} {box_scy:.6f} {box_sw:.6f} {box_sh:.6f}",
        ]

        img_filename = f"fire_{split}_{index:03d}.jpg"
        lbl_filename = f"fire_{split}_{index:03d}.txt"

        target_img = (train_img_dir if split == "train" else val_img_dir) / img_filename
        target_lbl = (train_lbl_dir if split == "train" else val_lbl_dir) / lbl_filename

        cv2.imwrite(str(target_img), img)
        with open(target_lbl, "w", encoding="utf-8") as f:
            f.write("\n".join(labels) + "\n")

    for i in range(num_train):
        create_fire_scene("train", i + 1)
    for i in range(num_val):
        create_fire_scene("val", i + 1)

    print(f"[OK] Fire & Smoke dataset generated successfully in {root_dir}")


if __name__ == "__main__":
    generate_fire_dataset()
