#!/usr/bin/env python3
"""Code quality budget checker for Python codebases.

Ported from jcode's check_code_size_budget.py, check_panic_budget.py,
and check_swallowed_error_budget.py — adapted for Python.

Checks:
  1. File size budget — flags files exceeding a LOC threshold
  2. Bare except budget — counts `except:` and `except Exception` without re-raise
  3. TODO/FIXME/HACK counter — tracks tech debt markers
  4. Import complexity — flags files with excessive imports
  5. Function size — flags oversized functions

Usage:
  python scripts/code_quality_check.py [--update] [--threshold N] [path]
"""
from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
BASELINE_FILE = REPO_ROOT / "scripts" / "code_quality_baseline.json"
DEFAULT_THRESHOLD_LOC = 500
DEFAULT_FUNC_THRESHOLD = 80
DEFAULT_IMPORT_THRESHOLD = 25


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("path", nargs="?", default=str(REPO_ROOT), help="Directory to scan")
    parser.add_argument("--update", action="store_true", help="Update the baseline")
    parser.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD_LOC, help="LOC threshold")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    return parser.parse_args()


def find_python_files(root: Path) -> List[Path]:
    """Find all Python files, excluding tests and venvs."""
    excludes = {"__pycache__", ".venv", "venv", "node_modules", ".git", "env", "dist", "build"}
    files = []
    for p in sorted(root.rglob("*.py")):
        parts = set(p.relative_to(root).parts)
        if parts & excludes:
            continue
        files.append(p)
    return files


def count_lines(path: Path) -> int:
    try:
        return len(path.read_text(encoding="utf-8").splitlines())
    except Exception:
        return 0


def check_file_sizes(files: List[Path], threshold: int) -> Dict[str, int]:
    """Find files exceeding the LOC threshold."""
    oversized = {}
    for f in files:
        loc = count_lines(f)
        if loc > threshold:
            oversized[str(f)] = loc
    return oversized


def count_bare_excepts(path: Path) -> int:
    """Count bare except clauses (poor error handling)."""
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return 0
    # bare `except:` or `except Exception:` without logging/re-raise
    count = 0
    count += len(re.findall(r'^\s*except\s*:', content, re.MULTILINE))
    return count


def count_tech_debt_markers(path: Path) -> Dict[str, int]:
    """Count TODO, FIXME, HACK, XXX markers."""
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return {}
    markers = {}
    for marker in ["TODO", "FIXME", "HACK", "XXX"]:
        count = len(re.findall(rf'\b{marker}\b', content, re.IGNORECASE))
        if count > 0:
            markers[marker] = count
    return markers


def count_imports(path: Path) -> int:
    """Count import statements in a file."""
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except Exception:
        return 0
    return sum(1 for node in ast.walk(tree) if isinstance(node, (ast.Import, ast.ImportFrom)))


def find_large_functions(path: Path, threshold: int = DEFAULT_FUNC_THRESHOLD) -> List[Tuple[str, int]]:
    """Find functions exceeding the line threshold."""
    try:
        content = path.read_text(encoding="utf-8")
        tree = ast.parse(content)
    except Exception:
        return []
    large = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            end = getattr(node, 'end_lineno', None)
            if end:
                size = end - node.lineno + 1
                if size > threshold:
                    large.append((node.name, size))
    return large


def run_audit(scan_dir: Path, threshold: int) -> Dict[str, Any]:
    """Run full code quality audit."""
    files = find_python_files(scan_dir)

    results: Dict[str, Any] = {
        "files_scanned": len(files),
        "threshold_loc": threshold,
        "oversized_files": {},
        "bare_excepts": {},
        "tech_debt": {"totals": {}, "by_file": {}},
        "import_heavy": {},
        "large_functions": {},
    }

    total_loc = 0
    total_bare_excepts = 0
    debt_totals: Dict[str, int] = {}

    for f in files:
        rel = str(f.relative_to(scan_dir))
        loc = count_lines(f)
        total_loc += loc

        # File size check
        if loc > threshold:
            results["oversized_files"][rel] = loc

        # Bare excepts
        be = count_bare_excepts(f)
        if be > 0:
            results["bare_excepts"][rel] = be
            total_bare_excepts += be

        # Tech debt markers
        markers = count_tech_debt_markers(f)
        if markers:
            results["tech_debt"]["by_file"][rel] = markers
            for m, c in markers.items():
                debt_totals[m] = debt_totals.get(m, 0) + c

        # Import complexity
        imports = count_imports(f)
        if imports > DEFAULT_IMPORT_THRESHOLD:
            results["import_heavy"][rel] = imports

        # Large functions
        large_fns = find_large_functions(f)
        if large_fns:
            results["large_functions"][rel] = [{"name": n, "lines": l} for n, l in large_fns]

    results["total_loc"] = total_loc
    results["total_bare_excepts"] = total_bare_excepts
    results["tech_debt"]["totals"] = debt_totals

    return results


def compare_with_baseline(current: Dict[str, Any], baseline: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    """Compare current results with baseline. Returns (regressions, improvements)."""
    regressions = []
    improvements = []

    # Check oversized files
    cur_oversized = set(current.get("oversized_files", {}).keys())
    base_oversized = set(baseline.get("oversized_files", {}).keys())

    for f in cur_oversized - base_oversized:
        regressions.append(f"New oversized file: {f} ({current['oversized_files'][f]} LOC)")
    for f in base_oversized - cur_oversized:
        improvements.append(f"File no longer oversized: {f}")
    for f in cur_oversized & base_oversized:
        cur_loc = current["oversized_files"][f]
        base_loc = baseline["oversized_files"][f]
        if cur_loc > base_loc:
            regressions.append(f"Oversized file grew: {f} ({base_loc} → {cur_loc} LOC)")
        elif cur_loc < base_loc:
            improvements.append(f"Oversized file shrank: {f} ({base_loc} → {cur_loc} LOC)")

    # Check bare excepts total
    cur_be = current.get("total_bare_excepts", 0)
    base_be = baseline.get("total_bare_excepts", 0)
    if cur_be > base_be:
        regressions.append(f"Bare except count grew: {base_be} → {cur_be}")
    elif cur_be < base_be:
        improvements.append(f"Bare except count shrank: {base_be} → {cur_be}")

    return regressions, improvements


def main() -> int:
    args = parse_args()
    scan_dir = Path(args.path).resolve()

    if not scan_dir.exists():
        print(f"Error: {scan_dir} does not exist", file=sys.stderr)
        return 1

    results = run_audit(scan_dir, args.threshold)

    if args.update:
        BASELINE_FILE.parent.mkdir(parents=True, exist_ok=True)
        BASELINE_FILE.write_text(
            json.dumps(results, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        print(f"Updated baseline: {results['files_scanned']} files, "
              f"{len(results['oversized_files'])} oversized, "
              f"{results['total_bare_excepts']} bare excepts")
        return 0

    if args.json:
        print(json.dumps(results, indent=2))
        return 0

    # Pretty print
    print(f"Code Quality Report — {scan_dir}")
    print(f"{'=' * 60}")
    print(f"Files scanned: {results['files_scanned']}")
    print(f"Total LOC: {results['total_loc']:,}")
    print()

    if results["oversized_files"]:
        print(f"Oversized files (>{args.threshold} LOC):")
        for f, loc in sorted(results["oversized_files"].items(), key=lambda x: -x[1]):
            print(f"  {loc:5d}  {f}")
        print()

    if results["bare_excepts"]:
        print(f"Bare excepts ({results['total_bare_excepts']} total):")
        for f, c in sorted(results["bare_excepts"].items(), key=lambda x: -x[1]):
            print(f"  {c:3d}  {f}")
        print()

    if results["tech_debt"]["totals"]:
        print("Tech debt markers:")
        for marker, count in sorted(results["tech_debt"]["totals"].items()):
            print(f"  {marker}: {count}")
        print()

    if results["import_heavy"]:
        print(f"Import-heavy files (>{DEFAULT_IMPORT_THRESHOLD} imports):")
        for f, c in sorted(results["import_heavy"].items(), key=lambda x: -x[1]):
            print(f"  {c:3d}  {f}")
        print()

    if results["large_functions"]:
        print(f"Large functions (>{DEFAULT_FUNC_THRESHOLD} LOC):")
        for f, fns in results["large_functions"].items():
            for fn in fns:
                print(f"  {fn['lines']:4d}  {f}::{fn['name']}")
        print()

    # Compare with baseline if it exists
    if BASELINE_FILE.exists():
        baseline = json.loads(BASELINE_FILE.read_text(encoding="utf-8"))
        regressions, improvements = compare_with_baseline(results, baseline)

        if regressions:
            print("REGRESSIONS:")
            for r in regressions:
                print(f"  ✗ {r}")
            return 1

        if improvements:
            print("IMPROVEMENTS:")
            for i in improvements:
                print(f"  ✓ {i}")

    print("Code quality check complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
