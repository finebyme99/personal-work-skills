#!/usr/bin/env python3
"""Prepare an unchanged native Feishu card locally. No network or credentials."""

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key: " + key)
        result[key] = value
    return result


def reject_constant(value):
    raise ValueError("Non-finite JSON number: " + value)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def pointer(parent, key):
    return parent + "/" + str(key).replace("~", "~0").replace("/", "~1")


def inventory(card):
    result = {"images": [], "links": [], "buttons": [], "placeholder_candidates": []}
    expression = re.compile(r"\$\{[^{}]*\}|\{\{.*?\}\}", re.DOTALL)

    def visit(value, path=""):
        if isinstance(value, dict):
            if value.get("tag") == "button":
                result["buttons"].append({
                    "path": path, "text": value.get("text"),
                    "behaviors": value.get("behaviors", []),
                })
            for key, child in value.items():
                child_path = pointer(path, key)
                if key in ("img_key", "image_key"):
                    result["images"].append({"path": child_path, "key": child})
                if isinstance(child, str) and (
                    key in ("url", "href") or key.endswith("_url")
                ) and child:
                    result["links"].append({"path": child_path, "url": child})
                visit(child, child_path)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                visit(child, pointer(path, index))
        elif isinstance(value, str) and expression.search(value):
            result["placeholder_candidates"].append({"path": path, "value": value})

    visit(card)
    return result


def prepare(source_path, output_path):
    raw = source_path.read_bytes()
    source = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=unique_object,
                        parse_constant=reject_constant)
    if not isinstance(source, dict):
        raise ValueError("Expected a JSON object")
    wrapped = "dsl" in source
    card = source["dsl"] if wrapped else source
    variables = source.get("variables", []) if wrapped else []
    if not isinstance(variables, (list, dict)):
        raise ValueError("Variable declarations must be a list or object")
    if not isinstance(card, dict):
        raise ValueError("dsl must be a native card object")
    if card.get("type") == "template":
        raise ValueError("Template references cannot be expanded offline; supply a source export")
    schema = card.get("schema")
    if schema == "2.0":
        body = card.get("body")
        valid = isinstance(body, dict) and isinstance(body.get("elements"), list)
    elif schema in (None, "1.0"):
        valid = isinstance(card.get("elements"), list)
    else:
        raise ValueError("Unrecognized schema; inspect source without rewriting it")
    if not valid:
        raise ValueError("Missing native card elements; not a supported card/source wrapper")

    canonical = json.dumps(card, ensure_ascii=False, sort_keys=True,
                           separators=(",", ":"), allow_nan=False).encode("utf-8")
    details = inventory(card)
    review = bool(variables or details["placeholder_candidates"])
    manifest = {
        "format_version": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source_name": source_path.name,
        "source_format": "card_export" if wrapped else "native_card_json",
        "source_sha256": digest(raw),
        "card_sha256": digest(canonical),
        "fingerprint_algorithm": "sha256:utf8:python-json-sort_keys-compact-ensure_ascii_false",
        "schema": schema,
        "canonical_card_bytes": len(canonical),
        "variables": variables,
        "requires_binding_review": review,
        "validation_scope": "local extraction and basic shape only; no platform/resource validation",
        **details,
    }
    card_text = json.dumps(card, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    manifest_text = json.dumps(manifest, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    output_path.mkdir(parents=True, exist_ok=False)
    (output_path / "card.json").write_text(card_text, encoding="utf-8")
    (output_path / "manifest.json").write_text(manifest_text, encoding="utf-8")
    print(json.dumps({"out_dir": str(output_path.resolve()),
                      "card_sha256": manifest["card_sha256"],
                      "requires_binding_review": review,
                      "status": "binding_review_required" if review else "extracted"}))
    return 2 if review else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--out-dir", required=True, type=Path,
                        help="New directory only; existing directories are never overwritten")
    args = parser.parse_args()
    try:
        return prepare(args.source, args.out_dir)
    except (OSError, ValueError, RecursionError) as error:
        print("Preparation failed: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
