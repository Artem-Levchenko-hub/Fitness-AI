#!/usr/bin/env python3
"""Cross-platform single-instance lock (advisory; OS-released on process death).

The key virtue: the lock is held only while the owning process is alive. The OS
drops it the instant that process exits or dies -> no stale locks, no timestamp
TTL cleanup, no "is the holder still alive?" guessing.

POSIX uses fcntl.flock; Windows uses msvcrt.locking. Both are advisory,
non-blocking, and auto-released by the OS on process exit.

Two ways to use it:

1) In-process guard (for an idempotent python script/hook, e.g. a flush/compile
   step that an after-response hook fires every turn). Put at the top of main():

       lock = acquire_single_instance_lock("flush")
       if lock is None:
           print("another instance running; skip"); return 0
       # keep `lock` in a variable for the whole run -- if it gets GC'd/closed
       # early the OS releases the lock early. Returning from main() (process
       # exit) releases it.

2) Holder CLI (to gate a NON-python run such as a Claude scheduled session).
   The session shells out to a holder that grabs the lock and blocks:

       python single_instance_lock.py fitness-routine --hold --max-seconds 2100

   Prints "ACQUIRED <pid>" and holds until killed (release at run end) or until
   --max-seconds elapse. Prints "BUSY" and exits 1 if another holder is active.
   The --max-seconds TTL is an orphan backstop: if the gated session dies, the
   holder self-exits after the TTL (Windows does NOT auto-kill orphans), so the
   lock can never get stuck forever.

   Check-only (no hold): omit --hold -> acquires, writes pid, releases, exits 0
   (or 1 if BUSY). Useful as a cheap "is anything running?" probe.
"""
from __future__ import annotations

import argparse
import os
import sys
import tempfile
import time
from pathlib import Path


def acquire_single_instance_lock(name: str, lock_dir: "Path | None" = None):
    """Try to take an exclusive, non-blocking advisory lock named `name`.

    Returns an open file handle on success (KEEP IT for the whole run -- the OS
    releases the lock when the handle closes / the process exits), or None if
    another process already holds the lock (caller should skip its run).
    """
    d = lock_dir or Path(tempfile.gettempdir())
    d.mkdir(parents=True, exist_ok=True)
    handle = open(d / f"{name}.lock", "a+", encoding="utf-8")
    try:
        if os.name == "nt":  # Windows
            import msvcrt

            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:  # POSIX (macOS / Linux)
            import fcntl

            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        handle.close()
        return None
    # Record pid for human debugging. NOTE: no truncate() -- on Windows that can
    # disturb the byte-range lock at offset 0. Trailing leftover bytes are
    # harmless; the lock works via the byte-range lock, not the file content.
    try:
        handle.seek(0)
        handle.write(f"{os.getpid()} {int(time.time())}\n")
        handle.flush()
    except OSError:
        pass
    return handle


def release_single_instance_lock(handle) -> None:
    """Best-effort explicit release. Closing the handle / process exit also
    releases the OS lock, so this is optional but tidy."""
    if handle is None:
        return
    try:
        if os.name == "nt":
            import msvcrt

            try:
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            except OSError:
                pass
    finally:
        try:
            handle.close()
        except OSError:
            pass


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Cross-platform single-instance lock")
    p.add_argument("name", help="unique lock name per script/routine (ASCII recommended)")
    p.add_argument("--hold", action="store_true",
                   help="hold the lock (block) until killed or --max-seconds elapse")
    p.add_argument("--max-seconds", type=int, default=2100,
                   help="auto-release after N seconds even if not killed (orphan backstop; default 2100=35min)")
    p.add_argument("--lock-dir", default=None, help="directory for the .lock file (default: OS temp)")
    args = p.parse_args(argv)

    lock_dir = Path(args.lock_dir) if args.lock_dir else None
    handle = acquire_single_instance_lock(args.name, lock_dir)
    if handle is None:
        print("BUSY")
        return 1

    print(f"ACQUIRED {os.getpid()}")
    sys.stdout.flush()
    if not args.hold:
        release_single_instance_lock(handle)
        return 0

    deadline = time.time() + max(1, args.max_seconds)
    try:
        while time.time() < deadline:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        release_single_instance_lock(handle)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
