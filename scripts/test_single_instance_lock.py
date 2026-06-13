#!/usr/bin/env python3
"""Characterization test for single_instance_lock.

Proves the real contract: while one process holds the lock, a SECOND process
(real subprocess -- the only honest test) is refused (BUSY / exit 1); once the
first releases, a new process can acquire (exit 0).

Run:  python scripts/test_single_instance_lock.py   (exit 0 = PASS)
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from single_instance_lock import (  # noqa: E402
    acquire_single_instance_lock,
    release_single_instance_lock,
)

CLI = str(HERE / "single_instance_lock.py")


def _contend(name: str, lock_dir: Path) -> int:
    """Spawn a separate process that tries to acquire (no --hold) and exits.
    Returns its exit code: 0 = got the lock, 1 = BUSY."""
    return subprocess.call(
        [sys.executable, CLI, name, "--lock-dir", str(lock_dir)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def test_concurrent_blocks_then_frees() -> None:
    lock_dir = Path(tempfile.mkdtemp(prefix="lock_test_"))
    name = "selftest"

    held = acquire_single_instance_lock(name, lock_dir)
    assert held is not None, "first acquire must succeed"

    busy = _contend(name, lock_dir)
    assert busy == 1, f"a second process must be refused while held (expected exit 1, got {busy})"

    release_single_instance_lock(held)

    free = _contend(name, lock_dir)
    assert free == 0, f"after release a new process must acquire (expected exit 0, got {free})"

    # different lock name must never block this one
    other = _contend("other-name", lock_dir)
    assert other == 0, f"a different lock name must be independent (expected 0, got {other})"

    print("PASS: single-instance lock blocks a concurrent process and frees on release")


if __name__ == "__main__":
    test_concurrent_blocks_then_frees()
