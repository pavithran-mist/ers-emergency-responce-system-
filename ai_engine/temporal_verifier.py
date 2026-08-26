"""Temporal verification and debounce filter to eliminate false alarms and duplicate spam."""

from __future__ import annotations
import time
from typing import List, Dict, Any, Tuple, Optional
from ai_engine.tracker import compute_iou


class TemporalVerifier:
    """Verifies events across temporal frame windows and applies incident debounce."""

    def __init__(
        self,
        window_size: int = 6,
        min_hits: int = 3,
        cooldown_seconds: float = 6.0,
        iou_match_threshold: float = 0.20,
    ):
        self.window_size = window_size
        self.min_hits = min_hits
        self.cooldown_seconds = cooldown_seconds
        self.iou_match_threshold = iou_match_threshold

        # Sliding window buffer of raw candidate events: list of (event_dict, frame_index, timestamp)
        self.history: List[Tuple[Dict[str, Any], int, float]] = []
        self.frame_count: int = 0

        # Cooldown map: key -> last_incident_trigger_time
        self.active_incidents: Dict[str, float] = {}

    def process_frame(
        self,
        candidate_events: List[Dict[str, Any]],
        timestamp: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Verify candidate events using temporal persistence and cooldown filtering.
        
        Returns:
            List of verified events ready for incident creation / alerting.
        """
        if timestamp is None:
            timestamp = time.time()

        self.frame_count += 1

        # Add current frame's candidates to history
        for ev in candidate_events:
            self.history.append((ev, self.frame_count, timestamp))

        # Evict events older than window_size
        cutoff_frame = self.frame_count - self.window_size
        self.history = [item for item in self.history if item[1] >= cutoff_frame]

        verified_events: List[Dict[str, Any]] = []

        for curr_ev in candidate_events:
            event_type = curr_ev.get("event_type", "unknown")
            bbox = tuple(curr_ev.get("bounding_box", (0, 0, 0, 0)))

            # Count occurrences in temporal window
            hits = 0
            max_conf = curr_ev.get("confidence", 0.5)

            for past_ev, past_frame, past_time in self.history:
                if past_ev.get("event_type") == event_type:
                    past_bbox = tuple(past_ev.get("bounding_box", (0, 0, 0, 0)))
                    iou = compute_iou(bbox, past_bbox)
                    # Either significant IoU or same primary vehicle track ID
                    related_curr = set(curr_ev.get("related_vehicles", []))
                    related_past = set(past_ev.get("related_vehicles", []))
                    has_common_vehicle = bool(related_curr and related_past and (related_curr & related_past))

                    # Fire and smoke must also persist in the same visual area.
                    # Treating every fire/smoke colour candidate as related allowed
                    # unrelated bright or grey regions to accumulate into an alert.
                    if iou >= self.iou_match_threshold or has_common_vehicle:
                        hits += 1
                        max_conf = max(max_conf, past_ev.get("confidence", 0.5))

            if hits >= self.min_hits:
                # Event is temporally verified. Check cooldown to prevent record flooding
                signature = f"{event_type}_{bbox[0]//80}_{bbox[1]//80}"
                last_triggered = self.active_incidents.get(signature, 0.0)

                is_new_alert = (timestamp - last_triggered) > self.cooldown_seconds
                if is_new_alert:
                    self.active_incidents[signature] = timestamp
                    verified_ev = dict(curr_ev)
                    verified_ev["confidence"] = round(max_conf, 3)
                    verified_ev["temporal_hits"] = hits
                    verified_ev["is_new_incident"] = True
                    verified_events.append(verified_ev)

        # Cleanup expired active incidents
        self.active_incidents = {
            sig: t for sig, t in self.active_incidents.items()
            if (timestamp - t) <= (self.cooldown_seconds * 2)
        }

        return verified_events
