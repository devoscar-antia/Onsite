"""
Video counting with YOLO + ByteTrack + line crossing.
Defaults tuned for Procesamiento.mp4 (line at 75% height, softer conf gates).
Run: python process_count_video.py
"""
import argparse
import os
from datetime import datetime
from statistics import median

import cv2
import torch
from ultralytics import YOLO


def parse_args():
    parser = argparse.ArgumentParser(description="Process video with YOLO line-crossing counter.")
    parser.add_argument("--model", default="D:/Onsite/conveyor-product-counter/models/conveyor-products/product_bag_detector.pt")
    parser.add_argument("--source", default="D:/Onsite/conveyor-product-counter/assets/videos/Procesamiento.mp4")
    parser.add_argument("--output-dir", default="D:/Onsite/conveyor-product-counter/assets/processed_videos")
    parser.add_argument(
        "--tracker",
        default="bytetrack.yaml",
        help="Tracker YAML path or built-in tracker name (e.g. bytetrack.yaml).",
    )
    parser.add_argument(
        "--use-recall-tracker",
        action="store_true",
        help="Use local permissive ByteTrack config (can increase duplicate counts).",
    )
    parser.add_argument("--conf", type=float, default=0.28)
    parser.add_argument("--imgsz", type=int, default=960, help="Inference image size. Higher can improve recall (slower).")
    parser.add_argument("--augment", action="store_true", help="Enable test-time augmentation for higher recall (slower).")
    parser.add_argument(
        "--max-recall",
        action="store_true",
        help="Aggressive settings to reduce missed products (may increase false positives).",
    )
    parser.add_argument("--line-ratio", type=float, default=0.75)
    parser.add_argument("--product-name", default="product_bag")
    parser.add_argument("--direction", choices=["down", "up", "any"], default="down")
    parser.add_argument("--min-cross-px", type=int, default=6)
    parser.add_argument("--band-px", type=int, default=22)
    parser.add_argument("--min-track-frames", type=int, default=2)
    parser.add_argument("--min-box-conf", type=float, default=0.10)
    parser.add_argument("--count-cooldown-frames", type=int, default=20, help="Suppress duplicate counts near the same x-position.")
    parser.add_argument("--count-x-merge-px", type=int, default=120, help="X-distance to merge near-simultaneous crossing events.")
    parser.add_argument(
        "--lane-dedupe",
        action="store_true",
        help="Enable lane-based temporal dedupe to prevent recounts when IDs switch near the line.",
    )
    parser.add_argument("--lane-width-px", type=int, default=110, help="Lane width in pixels for lane dedupe.")
    parser.add_argument(
        "--lane-window-frames",
        type=int,
        default=35,
        help="Temporal window to suppress recounts in the same lane.",
    )
    parser.add_argument("--count-anchor", choices=["center", "bottom"], default="bottom")
    parser.add_argument(
        "--keep-all-videos",
        action="store_true",
        help="Do not delete previous processed videos; keep all outputs for comparison.",
    )
    parser.add_argument(
        "--device",
        default="auto",
        help="auto: GPU si hay CUDA, si no CPU. 0/1/…: forzar esa GPU (falla sin CUDA). cpu: forzar CPU.",
    )
    return parser.parse_args()


def resolve_device(device_str):
    s = str(device_str).strip().lower()
    if s == "cpu":
        return "cpu"
    if s == "auto":
        if torch.cuda.is_available():
            return int(torch.cuda.current_device())
        print(
            "Dispositivo: CPU (CUDA no disponible: sin GPU NVIDIA visible o PyTorch +cpu). "
            "Para GPU instala drivers NVIDIA y PyTorch CUDA; ver https://pytorch.org/get-started/locally/"
        )
        return "cpu"
    wants_gpu = s.isdigit() or s.startswith("cuda")
    if wants_gpu and not torch.cuda.is_available():
        raise RuntimeError(
            "Se pidió GPU (--device %s) pero torch.cuda.is_available() es False.\n"
            "1) Comprueba GPU NVIDIA y drivers (nvidia-smi).\n"
            "2) Instala PyTorch con CUDA (evita índices pip que pidan login); ejemplo:\n"
            "   pip install --isolated torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124\n"
            "3) O ejecuta con --device auto para usar CPU hasta tener CUDA."
            % (device_str,)
        )
    if s.isdigit():
        return int(s)
    return device_str


def side_from_y(cy, line_y, band_px):
    if cy < line_y - band_px:
        return "above"
    if cy > line_y + band_px:
        return "below"
    return "band"


def anchor_y(y1, y2, mode):
    return int(y2) if mode == "bottom" else int((y1 + y2) / 2)


def geometry_line_cross(prev_y, curr_y, line_y, direction):
    if prev_y == curr_y:
        return False
    down = prev_y < line_y and curr_y >= line_y
    up = prev_y > line_y and curr_y <= line_y
    if direction == "down":
        return down
    if direction == "up":
        return up
    return down or up


def keep_only_latest_video(output_dir):
    videos = [os.path.join(output_dir, f) for f in os.listdir(output_dir) if f.lower().endswith(".mp4")]
    if len(videos) <= 1:
        return
    latest = max(videos, key=os.path.getmtime)
    for path in videos:
        if path != latest:
            try:
                os.remove(path)
            except OSError:
                pass


def main():
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)
    tracker_path = args.tracker
    local_recall_tracker = "D:/Onsite/conveyor-product-counter/bytetrack_recall.yaml"
    if args.max_recall:
        # Prioritize recall: detect more weak/short appearances.
        args.conf = min(args.conf, 0.12)
        args.min_box_conf = min(args.min_box_conf, 0.06)
        args.min_track_frames = min(args.min_track_frames, 1)
        args.augment = True
        args.imgsz = max(args.imgsz, 1280)
        args.lane_dedupe = True
        if args.use_recall_tracker and args.tracker == "bytetrack.yaml" and os.path.exists(local_recall_tracker):
            tracker_path = local_recall_tracker

    device = resolve_device(args.device)
    model = YOLO(args.model)
    cap = cv2.VideoCapture(args.source)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open source video: {args.source}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    line_y = int(height * args.line_ratio)

    out_name = f"processed_count_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
    out_path = os.path.join(args.output_dir, out_name)
    # Prefer browser-friendly codecs for web playback.
    writer = None
    chosen_codec = None
    for codec in ("avc1", "H264", "mp4v"):
        try:
            candidate = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*codec), fps if fps > 0 else 30.0, (width, height))
            if candidate.isOpened():
                writer = candidate
                chosen_codec = codec
                break
            candidate.release()
        except Exception:
            continue
    if writer is None:
        raise RuntimeError("Could not initialize video writer for processed output.")
    print(f"Output codec selected: {chosen_codec}")

    count = 0
    track_state = {}
    counted_ids = set()
    recent_count_events = []
    flash_frames = 0
    frame_idx = 0
    untracked_total = 0
    untracked_peak_per_frame = 0
    print(
        "Active params | "
        f"conf={args.conf}, min_box_conf={args.min_box_conf}, min_track_frames={args.min_track_frames}, "
        f"imgsz={args.imgsz}, augment={args.augment}, max_recall={args.max_recall}, tracker={tracker_path}, "
        f"lane_dedupe={args.lane_dedupe}"
    )

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_idx += 1

        results = model.track(
            frame,
            persist=True,
            conf=args.conf,
            imgsz=args.imgsz,
            augment=args.augment,
            verbose=False,
            tracker=tracker_path,
            device=device,
        )
        if results and results[0].boxes is not None:
            boxes = results[0].boxes
            xyxy = boxes.xyxy.cpu().tolist()
            confs = boxes.conf.cpu().tolist() if boxes.conf is not None else [1.0] * len(xyxy)
            ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(xyxy)
            untracked_in_frame = 0

            for track_id, box, conf in zip(ids, xyxy, confs):
                x1, y1, x2, y2 = [int(v) for v in box]
                cx = int((x1 + x2) / 2)
                cy = int((y1 + y2) / 2)
                track_y = anchor_y(y1, y2, args.count_anchor)

                if track_id is not None:
                    state = track_state.setdefault(
                        track_id,
                        {
                            "prev_y": track_y,
                            "prev_side": side_from_y(track_y, line_y, args.band_px),
                            "enter_side": None,
                            "seen": 0,
                            "conf_hist": [],
                            "ymin": track_y,
                            "ymax": track_y,
                            "ymin_top": y1,
                            "ymax_bot": y2,
                        },
                    )
                    state["seen"] += 1
                    state["ymin"] = min(state["ymin"], track_y)
                    state["ymax"] = max(state["ymax"], track_y)
                    state["ymin_top"] = min(state["ymin_top"], y1)
                    state["ymax_bot"] = max(state["ymax_bot"], y2)
                    state["conf_hist"].append(float(conf))
                    if len(state["conf_hist"]) > 8:
                        state["conf_hist"] = state["conf_hist"][-8:]

                    current_side = side_from_y(track_y, line_y, args.band_px)
                    previous_side = state["prev_side"]
                    previous_y = state["prev_y"]

                    if track_id not in counted_ids and state["seen"] >= args.min_track_frames and median(state["conf_hist"]) >= args.min_box_conf:
                        if current_side == "band" and previous_side in ("above", "below"):
                            state["enter_side"] = previous_side

                        direct_cross = previous_side in ("above", "below") and current_side in ("above", "below") and previous_side != current_side
                        band_cross = (state["enter_side"] == "above" and current_side == "below") or (
                            state["enter_side"] == "below" and current_side == "above"
                        )
                        geom_cross = geometry_line_cross(previous_y, track_y, line_y, args.direction)
                        path_cross_down = state["ymin_top"] < line_y and track_y >= line_y
                        path_cross_up = state["ymax_bot"] > line_y and track_y <= line_y
                        path_extra_down = path_cross_down and not band_cross and not direct_cross and not geom_cross
                        path_extra_up = path_cross_up and not band_cross and not direct_cross and not geom_cross
                        path_extra = (args.direction == "down" and path_extra_down) or (args.direction == "up" and path_extra_up) or (
                            args.direction == "any" and (path_extra_down or path_extra_up)
                        )
                        enough_movement = abs(track_y - previous_y) >= args.min_cross_px

                        moved_down = (
                            (state["enter_side"] == "above" and current_side == "below")
                            or (previous_y < line_y and track_y >= line_y)
                            or path_cross_down
                        )
                        moved_up = (
                            (state["enter_side"] == "below" and current_side == "above")
                            or (previous_y > line_y and track_y <= line_y)
                            or path_cross_up
                        )
                        direction_ok = args.direction == "any" or (args.direction == "down" and moved_down) or (args.direction == "up" and moved_up)

                        crossing = band_cross or direct_cross or geom_cross or path_extra
                        movement_ok = enough_movement or geom_cross or path_extra

                        if crossing and movement_ok and direction_ok:
                            recent_count_events = [
                                event
                                for event in recent_count_events
                                if frame_idx - event["frame"] <= max(args.count_cooldown_frames, args.lane_window_frames)
                            ]
                            lane_width = max(args.lane_width_px, 1)
                            lane_idx = int(cx // lane_width)
                            duplicate_event = any(
                                abs(frame_idx - event["frame"]) <= args.count_cooldown_frames
                                and abs(cx - event["x"]) <= args.count_x_merge_px
                                for event in recent_count_events
                            )
                            lane_duplicate_event = any(
                                abs(frame_idx - event["frame"]) <= args.lane_window_frames and lane_idx == event["lane"]
                                for event in recent_count_events
                            )
                            suppress_duplicate = lane_duplicate_event if args.lane_dedupe else duplicate_event
                            if not suppress_duplicate:
                                count += 1
                                counted_ids.add(track_id)
                                recent_count_events.append({"frame": frame_idx, "x": cx, "lane": lane_idx})
                                flash_frames = 18

                        if state["enter_side"] is not None and current_side == state["enter_side"]:
                            state["enter_side"] = None

                    state["prev_y"] = track_y
                    state["prev_side"] = current_side

                cv2.rectangle(frame, (x1, y1), (x2, y2), (40, 255, 40), 2)
                cv2.circle(frame, (cx, cy), 4, (0, 255, 255), -1)
                tag = f"ID {track_id}" if track_id is not None else f"DET {conf:.2f}"
                cv2.putText(frame, tag, (x1, max(y1 - 8, 20)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
                if track_id is None:
                    untracked_in_frame += 1

            untracked_total += untracked_in_frame
            untracked_peak_per_frame = max(untracked_peak_per_frame, untracked_in_frame)

        cv2.line(frame, (0, line_y), (width, line_y), (0, 0, 255), 4)
        cv2.rectangle(frame, (width - 455, 12), (width - 15, 122), (15, 15, 15), -1)
        cv2.rectangle(frame, (width - 455, 12), (width - 15, 122), (0, 255, 0), 2)
        cv2.putText(frame, f"Producto: {args.product_name}", (width - 439, 54), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(frame, f"Contador: {count}", (width - 439, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 3, cv2.LINE_AA)

        if flash_frames > 0:
            overlay = frame.copy()
            cv2.rectangle(overlay, (0, 0), (width, height), (0, 60, 0), -1)
            frame = cv2.addWeighted(overlay, 0.18, frame, 0.82, 0)
            (tw, th), _ = cv2.getTextSize("+1", cv2.FONT_HERSHEY_SIMPLEX, 4.5, 10)
            cv2.putText(frame, "+1", ((width - tw) // 2, (height + th) // 2), cv2.FONT_HERSHEY_SIMPLEX, 4.5, (255, 255, 255), 10, cv2.LINE_AA)
            flash_frames -= 1

        writer.write(frame)
        if frame_idx % 100 == 0:
            print(f"Processed {frame_idx} frames, count={count}")

    cap.release()
    writer.release()
    print(f"Done. Final count={count}")
    print(
        "Tracking diagnostics | "
        f"untracked_total={untracked_total}, "
        f"untracked_peak_per_frame={untracked_peak_per_frame}"
    )
    print(f"Saved to: {out_path}")
    if args.keep_all_videos:
        print("Retention policy skipped: keeping all processed videos.")
    else:
        keep_only_latest_video(args.output_dir)
        print("Retention policy applied: kept latest processed video only.")


if __name__ == "__main__":
    main()
