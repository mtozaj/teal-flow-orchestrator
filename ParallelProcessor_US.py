import os
import subprocess
import threading
import sys
import datetime  # ADDED – for timestamps
import pathlib   # ADDED – for automatic run log
from supabase import create_client, Client

# ------------------------------------------------------------------- #
# 1)  open a dated log-file that will receive *everything* we print   #
# ------------------------------------------------------------------- #
LOGFILE = pathlib.Path(                       # ADDED
    f"run_{datetime.datetime.now():%Y%m%d_%H%M%S}.log"
).open("a", encoding="utf-8")                 # ADDED

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
BATCH_ID = os.environ.get("BATCH_ID")

# Lock to synchronize console output from multiple threads
print_lock = threading.Lock()

def safe_print(message: str) -> None:
    """Thread-safe print helper that prefixes [hh:mm:ss]
       and duplicates the line into LOGFILE."""
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")  # ADDED
    line = f"[{timestamp}] {message}"                          # ADDED
    with print_lock:
        print(line, flush=True)                                # CHANGED
        LOGFILE.write(line + "\n")                             # ADDED

def read_output(process, idx, eid):
    # Read stdout
    for raw in process.stdout:
        text = raw.rstrip()
        safe_print(f"[Worker #{idx + 1}: EID {eid}] -> {text}")
    # Read stderr
    for raw in process.stderr:
        text = raw.rstrip()
        safe_print(f"[Worker #{idx + 1}: EID {eid} ERROR] -> {text}")


def fetch_eids(batch_id: str) -> list[str]:
    """Fetch EIDs for the given batch from Supabase."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        safe_print("Missing Supabase credentials; cannot fetch EIDs")
        sys.exit(1)

    client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    resp = client.table("esim_results").select("eid").eq("batch_id", batch_id).execute()
    if getattr(resp, "error", None):
        raise RuntimeError(f"Failed to fetch EIDs: {resp.error}")
    data = getattr(resp, "data", resp)
    return [row["eid"] for row in data]

def main():
    # Get the directory where the script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))

    if not BATCH_ID:
        safe_print("BATCH_ID environment variable is required")
        return

    # Fetch EIDs from Supabase
    try:
        eids = fetch_eids(BATCH_ID)
    except Exception as exc:
        safe_print(f"Error fetching EIDs: {exc}")
        return

    if not eids:
        safe_print("No EIDs found – exiting.")
        return

    tealus_path = os.path.join(script_dir, 'TealUS.py')

    client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # Mark batch as running
    client.table("batches").update({
        "status": "RUNNING",
        "updated_at": datetime.datetime.utcnow().isoformat()
    }).eq("id", BATCH_ID).execute()

    # Start subprocesses for each EID
    processes = []
    for idx, eid in enumerate(eids):
        env = os.environ.copy()
        env["BATCH_ID"] = BATCH_ID
        process = subprocess.Popen(
            [sys.executable, tealus_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            cwd=script_dir,
            env=env
        )
        process.stdin.write(f"{eid}\n")
        process.stdin.flush()
        process.stdin.close()

        t = threading.Thread(target=read_output, args=(process, idx, eid))
        t.start()
        processes.append((process, eid, t))

    # Gather results
    results = {}
    for process, eid, t in processes:
        return_code = process.wait()
        t.join()
        status = 'PASS' if return_code == 0 else 'FAIL'
        results[eid] = status
        if status == 'PASS':
            client.rpc('increment_batch_success', {'batch_id': BATCH_ID}).execute()
        else:
            client.rpc('increment_batch_failure', {'batch_id': BATCH_ID}).execute()

    # Summary
    safe_print("\nSummary of EID Processing:")
    for eid, status in results.items():
        safe_print(f"{eid}: {status}")

    final_status = 'COMPLETED' if all(v == 'PASS' for v in results.values()) else 'FAILED'
    client.table('batches').update({
        'status': final_status,
        'completed_at': datetime.datetime.utcnow().isoformat(),
        'updated_at': datetime.datetime.utcnow().isoformat()
    }).eq('id', BATCH_ID).execute()

    LOGFILE.close()                                            # ADDED

if __name__ == '__main__':
    main()
