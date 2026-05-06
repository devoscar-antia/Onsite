import argparse
from pathlib import Path

from features.conveyor_products.pipeline import run_conveyor_products_pipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Conveyor Product Counter - Feature Runner")
    parser.add_argument(
        "--feature",
        required=True,
        choices=[
            "conveyor_products",
            "fire_detection",
            "first_aid_safety_equipment_detection",
            "people_flow_trajectory",
        ],
        help="Feature to execute.",
    )
    parser.add_argument("--source", default=None, help="Optional input source path (video/stream).")
    parser.add_argument("--output-dir", default=None, help="Optional output directory.")
    parser.add_argument("--model", default=None, help="Optional model path override.")
    return parser.parse_args()


def run_feature(args: argparse.Namespace) -> int:
    if args.feature == "conveyor_products":
        source = Path(args.source) if args.source else None
        output_dir = Path(args.output_dir) if args.output_dir else None
        model_path = Path(args.model) if args.model else None
        return run_conveyor_products_pipeline(source=source, output_dir=output_dir, model_path=model_path)

    if args.feature == "fire_detection":
        print("Feature 'fire_detection' is planned but not implemented yet.")
        return 0

    if args.feature == "first_aid_safety_equipment_detection":
        print("Feature 'first_aid_safety_equipment_detection' is planned but not implemented yet.")
        return 0

    if args.feature == "people_flow_trajectory":
        print("Feature 'people_flow_trajectory' is planned but not implemented yet.")
        return 0

    print(f"Unknown feature: {args.feature}")
    return 1


def main() -> int:
    args = parse_args()
    return run_feature(args)


if __name__ == "__main__":
    raise SystemExit(main())

