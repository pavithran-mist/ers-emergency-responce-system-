"""Dataset integrity and quality validator for YOLO road accident datasets."""

from __future__ import annotations
import os
import sys
import hashlib
from pathlib import Path
from typing import Dict, List, Set, Any, Tuple


class DatasetValidator:
    """Validates YOLO dataset integrity, formatting, label bounds, and leaks."""

    def __init__(self, dataset_root: str):
        self.root = Path(dataset_root)
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.stats: Dict[str, Any] = {
            "train_images": 0,
            "val_images": 0,
            "train_labels": 0,
            "val_labels": 0,
            "total_annotations": 0,
            "class_counts": {},
            "duplicate_hashes": 0,
            "leakage_count": 0,
        }

    def _file_hash(self, filepath: Path) -> str:
        """Compute SHA256 hash of an image."""
        h = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(8192):
                h.update(chunk)
        return h.hexdigest()

    def validate(self) -> Tuple[bool, Dict[str, Any], List[str], List[str]]:
        """Run all validation checks.
        
        Returns:
            Tuple of (is_valid, stats, errors, warnings)
        """
        self.errors.clear()
        self.warnings.clear()

        if not self.root.exists():
            self.errors.append(f"Dataset root directory does not exist: {self.root}")
            return False, self.stats, self.errors, self.warnings

        train_img_dir = self.root / "images" / "train"
        val_img_dir = self.root / "images" / "val"
        train_lbl_dir = self.root / "labels" / "train"
        val_lbl_dir = self.root / "labels" / "val"

        for p, name in [
            (train_img_dir, "images/train"),
            (val_img_dir, "images/val"),
            (train_lbl_dir, "labels/train"),
            (val_lbl_dir, "labels/val"),
        ]:
            if not p.exists():
                self.warnings.append(f"Directory {name} does not exist at {p}")

        # Collect files
        img_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        train_imgs = {p.stem: p for p in train_img_dir.glob("*") if p.suffix.lower() in img_exts} if train_img_dir.exists() else {}
        val_imgs = {p.stem: p for p in val_img_dir.glob("*") if p.suffix.lower() in img_exts} if val_img_dir.exists() else {}

        train_lbls = {p.stem: p for p in train_lbl_dir.glob("*.txt")} if train_lbl_dir.exists() else {}
        val_lbls = {p.stem: p for p in val_lbl_dir.glob("*.txt")} if val_lbl_dir.exists() else {}

        self.stats["train_images"] = len(train_imgs)
        self.stats["val_images"] = len(val_imgs)
        self.stats["train_labels"] = len(train_lbls)
        self.stats["val_labels"] = len(val_lbls)

        # 1. Check Image-Label matching
        self._check_pairing("Train", train_imgs, train_lbls)
        self._check_pairing("Validation", val_imgs, val_lbls)

        # 2. Validate Label Syntax & Normalized Bounds
        self._validate_labels("Train", train_lbls)
        self._validate_labels("Validation", val_lbls)

        # 3. Check for Duplicates & Train/Val Leakage
        self._check_duplicates_and_leakage(train_imgs, val_imgs)

        is_valid = len(self.errors) == 0
        return is_valid, self.stats, self.errors, self.warnings

    def _check_pairing(self, split: str, imgs: Dict[str, Path], lbls: Dict[str, Path]) -> None:
        """Verify 1-to-1 matching between images and label files."""
        for stem in imgs:
            if stem not in lbls:
                self.warnings.append(f"[{split}] Missing label file for image: {imgs[stem].name}")

        for stem in lbls:
            if stem not in imgs:
                self.errors.append(f"[{split}] Orphan label file without image: {lbls[stem].name}")

    def _validate_labels(self, split: str, lbls: Dict[str, Path]) -> None:
        """Validate YOLO label format: <class_id> <x_center> <y_center> <width> <height>."""
        for stem, path in lbls.items():
            try:
                content = path.read_text(encoding="utf-8").strip()
                if not content:
                    self.warnings.append(f"[{split}] Empty label file (no bounding boxes): {path.name}")
                    continue

                lines = content.splitlines()
                for line_no, line in enumerate(lines, 1):
                    parts = line.strip().split()
                    if not parts:
                        continue

                    if len(parts) != 5:
                        self.errors.append(
                            f"[{split}] Invalid YOLO line format in {path.name}:{line_no} (expected 5 tokens, got {len(parts)}): '{line}'"
                        )
                        continue

                    try:
                        cls_id = int(parts[0])
                        x, y, w, h = map(float, parts[1:])
                    except ValueError:
                        self.errors.append(f"[{split}] Non-numeric values in {path.name}:{line_no}: '{line}'")
                        continue

                    # Validate bounds [0.0, 1.0]
                    for val_name, val in [("x_center", x), ("y_center", y), ("width", w), ("height", h)]:
                        if not (0.0 <= val <= 1.0):
                            self.errors.append(
                                f"[{split}] Bounding box coordinate {val_name}={val} out of [0, 1] range in {path.name}:{line_no}"
                            )

                    # Update stats
                    self.stats["total_annotations"] += 1
                    self.stats["class_counts"][cls_id] = self.stats["class_counts"].get(cls_id, 0) + 1

            except Exception as e:
                self.errors.append(f"[{split}] Failed reading label {path.name}: {e}")

    def _check_duplicates_and_leakage(self, train_imgs: Dict[str, Path], val_imgs: Dict[str, Path]) -> None:
        """Check image hash duplicates and leakage between train and val."""
        train_hashes: Dict[str, str] = {}  # hash -> stem
        val_hashes: Dict[str, str] = {}

        for stem, p in train_imgs.items():
            try:
                h = self._file_hash(p)
                if h in train_hashes:
                    self.warnings.append(f"[Train] Duplicate image content between {p.name} and {train_hashes[h]}")
                    self.stats["duplicate_hashes"] += 1
                train_hashes[h] = p.name
            except Exception:
                pass

        for stem, p in val_imgs.items():
            try:
                h = self._file_hash(p)
                if h in train_hashes:
                    self.errors.append(
                        f"[DATASET LEAKAGE] Image in validation ({p.name}) is identical to train ({train_hashes[h]})"
                    )
                    self.stats["leakage_count"] += 1
                val_hashes[h] = p.name
            except Exception:
                pass


def validate_dataset(dataset_path: str = "datasets/road_accident") -> bool:
    """Entrypoint function for dataset validation."""
    validator = DatasetValidator(dataset_path)
    is_valid, stats, errors, warnings = validator.validate()

    print(f"\n{'='*50}\nASTRA AI DATASET VALIDATION REPORT\n{'='*50}")
    print(f"Dataset Path: {dataset_path}")
    print(f"Train Images: {stats['train_images']} | Val Images: {stats['val_images']}")
    print(f"Train Labels: {stats['train_labels']} | Val Labels: {stats['val_labels']}")
    print(f"Total Annotations: {stats['total_annotations']}")
    print(f"Class Distribution: {stats['class_counts']}")
    print(f"Duplicates: {stats['duplicate_hashes']} | Train/Val Leakage: {stats['leakage_count']}")
    print(f"Warnings: {len(warnings)}")
    print(f"Errors: {len(errors)}")

    if warnings:
        print("\nWarnings:")
        for w in warnings[:10]:
            print(f"  [!] {w}")

    if errors:
        print("\nErrors:")
        for e in errors[:10]:
            print(f"  [x] {e}")

    print(f"\nStatus: {'PASSED [OK]' if is_valid else 'FAILED [FAIL]'}\n{'='*50}\n")
    return is_valid


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "datasets/road_accident"
    valid = validate_dataset(path)
    sys.exit(0 if valid else 1)
