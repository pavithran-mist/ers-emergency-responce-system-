"""Generates synthetic annotated training/validation images and labels for road accident detection."""

from __future__ import annotations
import os
import random
from pathlib import Path
import numpy as np
import cv2


def generate_sample_dataset(root_dir: str = "datasets/road_accident", num_train: int = 15, num_val: int = 5) -> None:
    """Generate annotated synthetic road accident images and YOLO label pairs with unique variations."""
    root = Path(root_dir)
    train_img_dir = root / "images" / "train"
    val_img_dir = root / "images" / "val"
    train_lbl_dir = root / "labels" / "train"
    val_lbl_dir = root / "labels" / "val"

    for d in [train_img_dir, val_img_dir, train_lbl_dir, val_lbl_dir]:
        d.mkdir(parents=True, exist_ok=True)

    def create_scene(split: str, index: int) -> None:
        width, height = 640, 480
        # Unique background shade and noise per image
        bg_val = 35 + (index * 3) % 25
        img = np.full((height, width, 3), (bg_val, bg_val + 3, bg_val + 7), dtype=np.uint8)

        # Unique road perspective
        road_top = 110 + (index * 5) % 30
        road_bot = 430 - (index * 4) % 25
        cv2.rectangle(img, (0, road_top), (width, road_bot), (50 + (index % 10), 52, 56), -1)

        # Unique lane lines
        dash_offset = (index * 17) % 40
        for x in range(-40 + dash_offset, width + 40, 45):
            cv2.line(img, (x, 270), (x + 22, 270), (220, 220, 220), 2)

        # Simulated accident vehicles
        cx1 = 200 + ((index * 29) % 240)
        cy1 = 220 + ((index * 19) % 120)
        cx2 = cx1 + 35 + ((index * 7) % 20)
        cy2 = cy1 + 10 + ((index * 5) % 15)

        # Draw vehicle 1 (angled/colliding)
        c1 = (random.randint(60, 220), random.randint(70, 200), random.randint(150, 240))
        cv2.rectangle(img, (cx1 - 25, cy1 - 15), (cx1 + 25, cy1 + 15), c1, -1)
        cv2.rectangle(img, (cx1 - 25, cy1 - 15), (cx1 + 25, cy1 + 15), (10, 10, 10), 2)

        # Draw vehicle 2 (colliding)
        c2 = (random.randint(180, 240), random.randint(50, 120), random.randint(50, 100))
        cv2.rectangle(img, (cx2 - 28, cy2 - 16), (cx2 + 28, cy2 + 16), c2, -1)
        cv2.rectangle(img, (cx2 - 28, cy2 - 16), (cx2 + 28, cy2 + 16), (10, 10, 10), 2)

        # Impact visual sparks & smoke
        cv2.circle(img, ((cx1 + cx2) // 2, (cy1 + cy2) // 2), 14 + (index % 6), (170, 170, 170), -1)
        cv2.circle(img, ((cx1 + cx2) // 2, (cy1 + cy2) // 2), 7, (0, 210, 255), -1)

        # Unique pixel watermark to prevent identical hash collisions across train/val
        cv2.putText(img, f"ASTRA-{split.upper()}-{index:03d}", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)

        # Calculate bounding box for accident (Class 0: accident)
        min_x = max(0, min(cx1 - 32, cx2 - 35))
        max_x = min(width, max(cx1 + 32, cx2 + 35))
        min_y = max(0, min(cy1 - 22, cy2 - 24))
        max_y = min(height, max(cy1 + 22, cy2 + 24))

        box_w = (max_x - min_x) / width
        box_h = (max_y - min_y) / height
        box_cx = ((min_x + max_x) / 2) / width
        box_cy = ((min_y + max_y) / 2) / height

        # Ensure normalized bounds
        box_cx = max(0.01, min(0.99, box_cx))
        box_cy = max(0.01, min(0.99, box_cy))
        box_w = max(0.02, min(0.98, box_w))
        box_h = max(0.02, min(0.98, box_h))

        labels = [f"0 {box_cx:.6f} {box_cy:.6f} {box_w:.6f} {box_h:.6f}"]

        # File paths
        img_filename = f"scene_{split}_{index:03d}.jpg"
        lbl_filename = f"scene_{split}_{index:03d}.txt"

        target_img_path = (train_img_dir if split == "train" else val_img_dir) / img_filename
        target_lbl_path = (train_lbl_dir if split == "train" else val_lbl_dir) / lbl_filename

        cv2.imwrite(str(target_img_path), img)
        with open(target_lbl_path, "w", encoding="utf-8") as f:
            f.write("\n".join(labels) + "\n")

    for i in range(num_train):
        create_scene("train", i + 1)
    for i in range(num_val):
        create_scene("val", i + 1)
    print(f"Sample dataset generated successfully in {root_dir}")


if __name__ == "__main__":
    generate_sample_dataset()
