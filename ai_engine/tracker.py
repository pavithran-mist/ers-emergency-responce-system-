"""Multi-vehicle tracking and kinematic trajectory analysis module."""

from __future__ import annotations
import math
import time
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
from ai_engine.detector import Detection


def compute_iou(boxA: Tuple[int, int, int, int], boxB: Tuple[int, int, int, int]) -> float:
    """Compute Intersection over Union (IoU) between two bounding boxes (x1, y1, x2, y2)."""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    inter_width = max(0, xB - xA)
    inter_height = max(0, yB - yA)
    inter_area = inter_width * inter_height

    if inter_area == 0:
        return 0.0

    boxA_area = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    boxB_area = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])

    union_area = float(boxA_area + boxB_area - inter_area)
    if union_area <= 0:
        return 0.0

    return inter_area / union_area


@dataclass
class TrackedVehicle:
    """Represents a tracked vehicle with motion history and kinematic state."""
    track_id: int
    class_name: str
    confidence: float
    bbox: Tuple[int, int, int, int]
    center: Tuple[int, int]
    velocity: Tuple[float, float] = (0.0, 0.0)  # (vx, vy) in pixels/frame
    speed: float = 0.0                         # magnitude in pixels/frame
    acceleration: float = 0.0                  # change in speed
    heading_angle: float = 0.0                 # in degrees [0, 360)
    history: List[Tuple[int, int, float]] = field(default_factory=list)  # (cx, cy, timestamp)
    speed_history: List[float] = field(default_factory=list)
    frames_since_seen: int = 0
    total_frames: int = 1
    created_at: float = field(default_factory=time.time)

    def update(self, detection: Detection, timestamp: float) -> None:
        """Update vehicle state with new detection."""
        prev_center = self.center
        prev_speed = self.speed
        
        self.bbox = detection.bbox
        self.center = detection.center
        self.confidence = 0.7 * self.confidence + 0.3 * detection.confidence
        self.class_name = detection.class_name
        self.frames_since_seen = 0
        self.total_frames += 1

        # Append to trajectory history (keep last 30 frames)
        self.history.append((detection.center[0], detection.center[1], timestamp))
        if len(self.history) > 30:
            self.history.pop(0)

        # Compute smoothed velocity
        dt = max(0.001, timestamp - self.history[-2][2]) if len(self.history) >= 2 else 0.033
        vx = (self.center[0] - prev_center[0])
        vy = (self.center[1] - prev_center[1])
        
        # Smooth velocity with exponential moving average
        alpha = 0.6
        self.velocity = (
            alpha * vx + (1 - alpha) * self.velocity[0],
            alpha * vy + (1 - alpha) * self.velocity[1],
        )

        current_speed = math.hypot(self.velocity[0], self.velocity[1])
        self.acceleration = (current_speed - prev_speed)
        self.speed = current_speed

        self.speed_history.append(self.speed)
        if len(self.speed_history) > 15:
            self.speed_history.pop(0)

        # Heading angle
        if current_speed > 1.0:
            angle = math.degrees(math.atan2(self.velocity[1], self.velocity[0]))
            self.heading_angle = (angle + 360) % 360

    def to_dict(self) -> Dict[str, Any]:
        return {
            "track_id": self.track_id,
            "class_name": self.class_name,
            "confidence": round(self.confidence, 3),
            "bbox": list(self.bbox),
            "center": list(self.center),
            "velocity": [round(v, 2) for v in self.velocity],
            "speed": round(self.speed, 2),
            "acceleration": round(self.acceleration, 2),
            "heading_angle": round(self.heading_angle, 1),
            "total_frames": self.total_frames,
        }


class VehicleTracker:
    """Multi-object tracker for road vehicles with trajectory calculation."""

    def __init__(
        self,
        max_age: int = 15,
        iou_threshold: float = 0.25,
        max_distance: float = 80.0,
    ):
        self.max_age = max_age
        self.iou_threshold = iou_threshold
        self.max_distance = max_distance
        self.next_track_id = 1
        self.tracks: Dict[int, TrackedVehicle] = {}

    def update(self, detections: List[Detection], timestamp: Optional[float] = None) -> List[TrackedVehicle]:
        """Update tracker with list of current frame detections."""
        if timestamp is None:
            timestamp = time.time()

        # Age existing tracks
        for track in self.tracks.values():
            track.frames_since_seen += 1

        unmatched_detections = list(range(len(detections)))
        unmatched_tracks = list(self.tracks.keys())

        # Match using IoU first, then centroid distance
        matches: List[Tuple[int, int]] = []

        if self.tracks and detections:
            cost_matrix = []
            for track_id in unmatched_tracks:
                track = self.tracks[track_id]
                row = []
                for det_idx in unmatched_detections:
                    det = detections[det_idx]
                    iou = compute_iou(track.bbox, det.bbox)
                    dist = math.hypot(track.center[0] - det.center[0], track.center[1] - det.center[1])
                    
                    # Higher score is better match
                    if iou > 0.1:
                        score = iou + 1.0  # prioritize overlap
                    elif dist < self.max_distance:
                        score = 1.0 - (dist / self.max_distance)
                    else:
                        score = 0.0
                    row.append(score)
                cost_matrix.append(row)

            # Greedy matching
            while True:
                best_score = 0.0
                best_t_idx = -1
                best_d_idx = -1

                for t_i, track_id in enumerate(unmatched_tracks):
                    if track_id is None:
                        continue
                    for d_i, det_idx in enumerate(unmatched_detections):
                        if det_idx is None:
                            continue
                        score = cost_matrix[t_i][d_i]
                        if score > best_score and score > 0.2:
                            best_score = score
                            best_t_idx = t_i
                            best_d_idx = d_i

                if best_score <= 0.2 or best_t_idx == -1 or best_d_idx == -1:
                    break

                track_id = unmatched_tracks[best_t_idx]
                det_idx = unmatched_detections[best_d_idx]
                matches.append((track_id, det_idx))

                unmatched_tracks[best_t_idx] = None  # type: ignore
                unmatched_detections[best_d_idx] = None  # type: ignore

        # Update matched tracks
        for track_id, det_idx in matches:
            if track_id in self.tracks and det_idx is not None:
                self.tracks[track_id].update(detections[det_idx], timestamp)

        # Create new tracks for unmatched detections
        for det_idx in unmatched_detections:
            if det_idx is not None:
                det = detections[det_idx]
                new_track = TrackedVehicle(
                    track_id=self.next_track_id,
                    class_name=det.class_name,
                    confidence=det.confidence,
                    bbox=det.bbox,
                    center=det.center,
                    history=[(det.center[0], det.center[1], timestamp)],
                )
                self.tracks[self.next_track_id] = new_track
                self.next_track_id += 1

        # Prune dead tracks
        dead_ids = [
            t_id for t_id, track in self.tracks.items()
            if track.frames_since_seen > self.max_age
        ]
        for t_id in dead_ids:
            del self.tracks[t_id]

        # Return currently active and visible tracks
        return [track for track in self.tracks.values() if track.frames_since_seen == 0]
