"""Evaluate estimates against independently reviewed measurements; never fabricates references."""
import argparse
import json
import math
from pathlib import Path

def evaluate(rows):
    errors=[]
    for row in rows:
        if not row.get("id") or row.get("reference_method") != "weighed_and_reviewed":
            raise ValueError("Each item needs an ID and an independently weighed_and_reviewed reference.")
        actual, estimate = row["reference"], row["estimate"]
        for field in ("calories", "protein", "carbs", "fat", "grams"):
            values=(actual[field],estimate[field])
            if any(not isinstance(value,(int,float)) or not math.isfinite(value) or value < 0 for value in values): raise ValueError("Measurements must be finite nonnegative numbers.")
        errors.append({field:abs(estimate[field]-actual[field]) for field in actual if field in ("calories","protein","carbs","fat","grams")})
    if not errors: raise ValueError("No measured benchmark records supplied.")
    return {"samples":len(errors),"mean_absolute_error":{field:round(sum(row[field] for row in errors)/len(errors),3) for field in errors[0]},"note":"Report per-cuisine, lighting and portion-size slices before making accuracy claims. Small or synthetic samples cannot certify nutrition accuracy."}

if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("measurements",type=Path);args=parser.parse_args()
    print(json.dumps(evaluate(json.loads(args.measurements.read_text())),indent=2))
