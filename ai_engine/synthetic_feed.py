"""Synthetic dynamic traffic and hazard video feed generator for realistic simulation."""

from __future__ import annotations
import math
import random
import time
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict, Any
import numpy as np
import cv2


@dataclass
class SimVehicle:
    id: int
    vtype: str  # 'car', 'truck', 'bus', 'motorcycle'
    x: float
    y: float
    vx: float
    vy: float
    color: Tuple[int, int, int]
    width: int
    height: int
    target_lane: int


class SyntheticTrafficGenerator:
    """Generates continuous procedural road traffic frames with simulated hazards (accidents, fire, smoke)."""

    def __init__(
        self,
        width: int = 640,
        height: int = 480,
        hazard_mode: str = "auto",  # 'normal', 'accident', 'fire', 'smoke', 'auto'
    ):
        self.width = width
        self.height = height
        self.hazard_mode = hazard_mode
        self.vehicles: List[SimVehicle] = []
        self.next_vid = 1
        self.frame_idx = 0
        self.start_time = time.time()
        
        # Hazard timeline in 'auto' mode
        self.hazard_state = "normal"
        self.hazard_timer = 0
        self.fire_particles: List[Dict] = []
        self.smoke_particles: List[Dict] = []
        
        self._init_traffic()

    def _init_traffic(self) -> None:
        """Spawn initial fleet of vehicles."""
        self.vehicles = []
        v_configs = [
            ("car", (50, 180, 240), 45, 24, 4.0),
            ("car", (220, 80, 50), 42, 22, 3.8),
            ("truck", (80, 80, 190), 75, 32, 2.5),
            ("bus", (40, 160, 80), 80, 30, 2.8),
            ("motorcycle", (200, 200, 50), 28, 14, 4.5),
            ("car", (180, 180, 180), 44, 23, 3.5),
        ]
        
        lanes_y = [170, 230, 300, 370]
        for i, (vtype, color, w, h, speed) in enumerate(v_configs):
            lane_idx = i % len(lanes_y)
            y = lanes_y[lane_idx]
            # Left-to-right lanes vs right-to-left lanes
            if lane_idx < 2:
                x = random.randint(20, self.width - 150)
                vx = speed + random.uniform(-0.5, 0.5)
            else:
                x = random.randint(150, self.width - 40)
                vx = -(speed + random.uniform(-0.5, 0.5))

            self.vehicles.append(
                SimVehicle(
                    id=self.next_vid,
                    vtype=vtype,
                    x=x,
                    y=y,
                    vx=vx,
                    vy=0.0,
                    color=color,
                    width=w,
                    height=h,
                    target_lane=lane_idx,
                )
            )
            self.next_vid += 1

    def _update_hazard_state(self) -> None:
        """Cycle through hazard states automatically for continuous testing."""
        self.hazard_timer += 1
        
        if self.hazard_mode != "auto":
            self.hazard_state = self.hazard_mode
            return

        # 300 frames per cycle: 0-140 normal, 141-210 accident scenario, 211-280 fire/smoke scenario, 281-300 reset
        cycle = self.hazard_timer % 320
        if cycle < 120:
            self.hazard_state = "normal"
        elif cycle < 200:
            self.hazard_state = "accident"
        elif cycle < 280:
            self.hazard_state = "fire"
        else:
            self.hazard_state = "normal"

    def get_next_frame(self) -> np.ndarray:
        """Render and return the next animated simulation frame."""
        self.frame_idx += 1
        self._update_hazard_state()

        # Canvas background (dark asphalt road with curbs)
        frame = np.full((self.height, self.width, 3), (35, 40, 45), dtype=np.uint8)

        # Draw Road Surface
        road_top = 130
        road_bottom = 430
        cv2.rectangle(frame, (0, road_top), (self.width, road_bottom), (45, 48, 52), -1)

        # Draw Road Curbs / Sidewalk
        cv2.rectangle(frame, (0, road_top - 12), (self.width, road_top), (80, 85, 90), -1)
        cv2.rectangle(frame, (0, road_bottom), (self.width, road_bottom + 12), (80, 85, 90), -1)

        # Draw Lane Markings (dashed yellow median and white dividers)
        lanes = [200, 275, 350]
        offset = int((self.frame_idx * 4) % 40)

        # White lane dividers
        for ly in [200, 350]:
            for x in range(-40 + offset, self.width + 40, 40):
                cv2.line(frame, (x, ly), (x + 20, ly), (220, 220, 220), 2)

        # Double solid/dashed yellow center median
        cv2.line(frame, (0, 273), (self.width, 273), (40, 200, 230), 2)
        cv2.line(frame, (0, 277), (self.width, 277), (40, 200, 230), 2)

        # Update and Draw Vehicles
        lanes_y = [170, 235, 310, 385]

        # Trigger simulated accident convergence if in accident hazard state
        if self.hazard_state == "accident" and len(self.vehicles) >= 2:
            # Force v0 and v1 into a head-on or side convergence
            v0 = self.vehicles[0]
            v1 = self.vehicles[1]
            v0.x = min(360, max(280, v0.x))
            v1.x = max(290, min(370, v1.x))
            v0.y = 235
            v1.y = 240
            v0.vx = 0.5
            v1.vx = -0.5
        else:
            # Normal vehicle physics
            for v in self.vehicles:
                v.x += v.vx
                # Wrap around screen edges
                if v.vx > 0 and v.x > self.width + 60:
                    v.x = -60
                elif v.vx < 0 and v.x < -60:
                    v.x = self.width + 60

        # Draw vehicles
        for v in self.vehicles:
            x1 = int(v.x - v.width // 2)
            y1 = int(v.y - v.height // 2)
            x2 = int(v.x + v.width // 2)
            y2 = int(v.y + v.height // 2)

            # Vehicle body
            cv2.rectangle(frame, (x1, y1), (x2, y2), v.color, -1)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (20, 20, 20), 2)

            # Windshield / windows
            wx1 = x1 + (8 if v.vx > 0 else v.width - 16)
            wx2 = x1 + (18 if v.vx > 0 else v.width - 6)
            cv2.rectangle(frame, (wx1, y1 + 3), (wx2, y2 - 3), (120, 140, 160), -1)

            # Headlights / Taillights
            if v.vx > 0:
                # Headlights right
                cv2.circle(frame, (x2 - 2, y1 + 4), 3, (100, 255, 255), -1)
                cv2.circle(frame, (x2 - 2, y2 - 4), 3, (100, 255, 255), -1)
                # Taillights left
                cv2.circle(frame, (x1 + 2, y1 + 4), 3, (30, 30, 240), -1)
                cv2.circle(frame, (x1 + 2, y2 - 4), 3, (30, 30, 240), -1)
            else:
                # Headlights left
                cv2.circle(frame, (x1 + 2, y1 + 4), 3, (100, 255, 255), -1)
                cv2.circle(frame, (x1 + 2, y2 - 4), 3, (100, 255, 255), -1)
                # Taillights right
                cv2.circle(frame, (x2 - 2, y1 + 4), 3, (30, 30, 240), -1)
                cv2.circle(frame, (x2 - 2, y2 - 4), 3, (30, 30, 240), -1)

        # Render Fire & Smoke if in fire hazard state
        if self.hazard_state == "fire":
            # Fire emitter center
            fx, fy = 320, 240

            # Spawn smoke particles
            for _ in range(3):
                self.smoke_particles.append({
                    "x": fx + random.uniform(-15, 15),
                    "y": fy - random.uniform(5, 20),
                    "r": random.uniform(12, 28),
                    "vy": random.uniform(-2.0, -0.8),
                    "vx": random.uniform(-0.5, 0.8),
                    "alpha": 0.5,
                    "gray": random.randint(110, 170),
                })

            # Draw & update smoke
            new_smoke = []
            for p in self.smoke_particles:
                p["x"] += p["vx"]
                p["y"] += p["vy"]
                p["r"] += 0.4
                p["alpha"] -= 0.015
                if p["alpha"] > 0.05 and p["y"] > 20:
                    px, py, pr = int(p["x"]), int(p["y"]), int(p["r"])
                    g = p["gray"]
                    cv2.circle(frame, (px, py), pr, (g, g, g), -1)
                    new_smoke.append(p)
            self.smoke_particles = new_smoke[-50:]

            # Draw Flame Cluster (bright orange/yellow/red)
            for _ in range(8):
                flame_x = fx + random.randint(-18, 18)
                flame_y = fy + random.randint(-15, 12)
                radius = random.randint(8, 22)
                # Flame colors (BGR: yellow/orange/red)
                color = random.choice([(0, 215, 255), (0, 140, 255), (20, 50, 240), (255, 255, 255)])
                cv2.circle(frame, (flame_x, flame_y), radius, color, -1)

        return frame
