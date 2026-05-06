from collections import Counter, defaultdict


def compute_summary(detections: list[dict]) -> dict:
    frame_counter = Counter(d["frame"] for d in detections)
    confidences = [d["confidence"] for d in detections]
    total_frames = max(frame_counter.keys()) if frame_counter else 0
    track_frame_counts: dict = defaultdict(int)
    for d in detections:
        tid = d.get("track_id")
        if tid is not None:
            track_frame_counts[tid] += 1
    # Only count tracks seen in >= 4 frames to filter re-ID fragments
    unique_tracks = sum(1 for cnt in track_frame_counts.values() if cnt >= 4)
    return {
        "total_detections": len(detections),
        "frames_with_detections": len(frame_counter),
        "total_frames": total_frames,
        "avg_confidence": (sum(confidences) / len(confidences)) if confidences else 0,
        "unique_classes": len({d["class"] for d in detections}),
        "unique_tracked_objects": unique_tracks,
    }


def compute_by_frame(detections: list[dict]) -> list[dict]:
    grouped: dict[int, list[dict]] = defaultdict(list)
    for item in detections:
        grouped[item["frame"]].append(item)
    return [
        {"frame": frame, "detections": len(items), "classes": sorted({x["class"] for x in items})}
        for frame, items in sorted(grouped.items())
    ]


def compute_class_distribution(detections: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for item in detections:
        grouped[item["class"]].append(item)
    total = len(detections) or 1
    rows = []
    for cls_name, items in grouped.items():
        avg_conf = sum(x["confidence"] for x in items) / len(items)
        rows.append({
            "class": cls_name,
            "count": len(items),
            "percentage": len(items) / total,
            "avg_confidence": avg_conf,
            "confidence": avg_conf,
            "first_frame": min(x["frame"] for x in items),
        })
    return sorted(rows, key=lambda x: x["count"], reverse=True)


def compute_confidence_timeline(detections: list[dict]) -> list[dict]:
    grouped: dict[int, list[float]] = defaultdict(list)
    for item in detections:
        grouped[item["frame"]].append(item["confidence"])
    return [
        {"frame": frame, "confidence": sum(values) / len(values)}
        for frame, values in sorted(grouped.items())
    ]


def compute_heatmap(detections: list[dict]) -> list[dict]:
    return [{"x": d["x"], "y": d["y"], "value": d["confidence"]} for d in detections]
