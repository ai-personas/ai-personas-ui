import json, copy, subprocess, sys
from calculations import calculate, timber_check
G=json.load(open("geometry.json")); checks=calculate(G)
assert all(c["pass"] for c in checks), "baseline calculation failed"
# Fail-capability tests: deliberately overload a member and wind system.
bad=copy.deepcopy(G); bad["structural_members"][1]["section_mm"]=[20,50]
assert not timber_check(bad["structural_members"][1])["pass"], "undersized-member mutation did not fail"
bad["loads"]["wind_kpa"]=20
assert not any(c["pass"] for c in calculate(bad) if c["member"]=="SW-01"), "wind mutation did not fail"
subprocess.run([sys.executable,"calculations.py"],check=True)
report=json.load(open("validation_report.json")); assert report["all_pass"]
print("ALL CHECKS PASS: baseline, reconciliation, and fail-capability tests")
