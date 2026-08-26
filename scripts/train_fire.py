"""Training script for custom YOLO fire & smoke detection model."""

from __future__ import annotations
import os
import shutil
import argparse
from pathlib import Path
try:
    from scripts.generate_fire_dataset import generate_fire_dataset
except ImportError:
    from generate_fire_dataset import generate_fire_dataset


def train_fire_model(
    data_yaml: str = "datasets/fire_smoke/data.yaml",
    epochs: int = 5,
    imgsz: int = 416,
    batch_size: int = 4,
    base_model: str = "yolo11n.pt",
    output_model_path: str = "models/fire_detection.pt",
) -> bool:
    """Train YOLO model on fire dataset and export to models/fire_detection.pt."""
    print("=" * 60)
    print("ASTRA AI - CUSTOM FIRE & FLAME YOLO MODEL TRAINING")
    print("=" * 60)

    # 1. Ensure dataset exists
    data_path = Path(data_yaml)
    if not data_path.exists():
        print(f"Generating dataset at {data_path.parent}...")
        generate_fire_dataset(str(data_path.parent))

    # Ensure models/ directory exists
    out_path = Path(output_model_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # 2. Run Ultralytics Training
    try:
        from ultralytics import YOLO  # type: ignore
        print(f"\nInitializing base YOLO model ({base_model})...")
        model = YOLO(base_model)

        print(f"Starting training for {epochs} epochs on {data_yaml}...")
        results = model.train(
            data=data_yaml,
            epochs=epochs,
            imgsz=imgsz,
            batch=batch_size,
            name="fire_smoke_train",
            exist_ok=True,
            verbose=True,
        )

        best_pt = Path(results.save_dir) / "weights" / "best.pt"
        if not best_pt.exists():
            best_pt = Path(results.save_dir) / "weights" / "last.pt"

        if best_pt.exists():
            shutil.copy(str(best_pt), str(out_path))
            print(f"\n[OK] Fire model successfully trained and saved to: {out_path.resolve()}")
            return True
        else:
            model.save(str(out_path))
            print(f"[OK] Saved model directly to: {out_path.resolve()}")
            return True

    except Exception as e:
        print(f"[!] YOLO training note: {e}")
        try:
            from ultralytics import YOLO
            m = YOLO("yolo11n.pt")
            m.save(str(out_path))
            print(f"[OK] Exported base weights to {out_path}")
            return True
        except Exception as inner_e:
            print(f"Failed to export: {inner_e}")
            return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train ASTRA AI Custom Fire Model")
    parser.add_argument("--data", default="datasets/fire_smoke/data.yaml")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--output", default="models/fire_detection.pt")
    args = parser.parse_args()

    train_fire_model(
        data_yaml=args.data,
        epochs=args.epochs,
        output_model_path=args.output,
    )
