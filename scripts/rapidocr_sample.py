from __future__ import annotations

import argparse
import csv
from pathlib import Path

from rapidocr_onnxruntime import RapidOCR


DEFAULT_SAMPLE_IDS = [
    2208,
    2209,
    2231,
    2232,
    2253,
    2256,
    2261,
    2265,
    2266,
    2272,
    2279,
    2286,
    2290,
    2295,
    2298,
    2301,
    2311,
    2318,
    2320,
    2325,
    2334,
    2343,
    2351,
    2357,
    2360,
    2364,
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run RapidOCR on selected game rule screenshots.")
    parser.add_argument(
        "--image-dir",
        required=True,
        help="Directory containing local screenshot images named IMG_*.PNG.",
    )
    parser.add_argument(
        "--out-dir",
        default="data/ocr",
        help="Directory for OCR outputs.",
    )
    parser.add_argument(
        "--ids",
        nargs="*",
        type=int,
        default=DEFAULT_SAMPLE_IDS,
        help="Image numeric IDs, for example 2208 2209.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Run OCR for all IMG_*.PNG files in image-dir.",
    )
    parser.add_argument(
        "--name",
        default="rapidocr_sample",
        help="Output file stem.",
    )
    return parser.parse_args()


def result_to_rows(filename: str, result: list | None) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for item in result or []:
        _box, text, confidence = item
        rows.append(
            {
                "filename": filename,
                "text": text,
                "confidence": f"{confidence:.4f}",
            }
        )
    return rows


def main() -> None:
    args = parse_args()
    image_dir = Path(args.image_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    ocr = RapidOCR()
    all_rows: list[dict[str, str]] = []
    if args.all:
        image_ids = [
            int(path.stem.split("_")[1])
            for path in sorted(image_dir.glob("IMG_*.PNG"))
        ]
    else:
        image_ids = args.ids

    title = "RapidOCR 全量识别结果" if args.all else "RapidOCR 抽样测试结果"
    markdown_lines = [
        f"# {title}",
        "",
        f"- 图片目录：`{image_dir}`",
        f"- 图片数量：{len(image_ids)}",
        "",
    ]
    qc_rows: list[dict[str, str]] = []

    for index, image_id in enumerate(image_ids, start=1):
        image_path = image_dir / f"IMG_{image_id}.PNG"
        if not image_path.exists():
            markdown_lines.extend([f"## IMG_{image_id}.PNG", "", "文件不存在。", ""])
            continue

        print(f"[{index}/{len(image_ids)}] OCR {image_path.name}", flush=True)
        result, elapse = ocr(str(image_path))
        rows = result_to_rows(image_path.name, result)
        all_rows.extend(rows)
        joined_text = "\n".join(row["text"] for row in rows)
        avg_conf = (
            sum(float(row["confidence"]) for row in rows) / len(rows)
            if rows
            else 0
        )
        flags = []
        if len(rows) < 6:
            flags.append("识别行数较少，可能是入口页/纯 UI/规则正文缺失")
        if avg_conf < 0.93:
            flags.append("平均置信度偏低，需要人工复核")
        if "规则" not in joined_text and "说明" not in joined_text and "玩法" not in joined_text and len(rows) > 0:
            flags.append("未识别到明显规则/说明关键词，可能缺少上下文")
        if len(rows) == 0:
            flags.append("未识别到文本")

        qc_rows.append(
            {
                "filename": image_path.name,
                "line_count": str(len(rows)),
                "avg_confidence": f"{avg_conf:.4f}",
                "flags": "；".join(flags),
            }
        )

        markdown_lines.extend(
            [
                f"## {image_path.name}",
                "",
                f"- 识别行数：{len(rows)}",
                f"- 平均置信度：{avg_conf:.4f}",
                f"- 耗时：det={elapse[0]:.3f}s, cls={elapse[1]:.3f}s, rec={elapse[2]:.3f}s",
                f"- 疑问标记：{'；'.join(flags) if flags else '无'}",
                "",
                "```text",
                joined_text,
                "```",
                "",
            ]
        )

    csv_path = out_dir / f"{args.name}.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["filename", "text", "confidence"])
        writer.writeheader()
        writer.writerows(all_rows)

    qc_path = out_dir / f"{args.name}_qc.csv"
    with qc_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["filename", "line_count", "avg_confidence", "flags"])
        writer.writeheader()
        writer.writerows(qc_rows)

    md_path = out_dir / f"{args.name}.md"
    md_path.write_text("\n".join(markdown_lines), encoding="utf-8")

    print(f"Wrote {md_path}")
    print(f"Wrote {csv_path}")
    print(f"Wrote {qc_path}")
    print(f"OCR rows: {len(all_rows)}")


if __name__ == "__main__":
    main()
