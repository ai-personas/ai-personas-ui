#!/usr/bin/env python3
import csv
import json
import sys

def csv_to_records(csv_path):
    with open(csv_path, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            raise ValueError("CSV has no header row")
        return [dict(row) for row in reader]

def records_to_json(records, json_path):
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, sort_keys=True)
        f.write("\n")

def json_to_records(json_path):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("JSON root must be a list")
    if not all(isinstance(row, dict) for row in data):
        raise ValueError("JSON records must be objects")
    return data

def records_to_csv(records, csv_path, fieldnames):
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="raise")
        writer.writeheader()
        writer.writerows(records)

def csv_to_json_file(csv_path, json_path):
    records = csv_to_records(csv_path)
    records_to_json(records, json_path)
    return records

def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 2:
        print("usage: converter.py input.csv output.json", file=sys.stderr)
        return 2
    csv_to_json_file(argv[0], argv[1])
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
