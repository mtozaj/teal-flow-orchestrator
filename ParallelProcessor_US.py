
import os
import subprocess
import csv
import threading
import sys
from typing import Optional
from supabase import create_client, Client

# Lock to synchronize console output from multiple threads
print_lock = threading.Lock()

SUPABASE_URL = "https://sciftjvjlpemhkvtokhi.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
BATCH_ID = os.environ.get("BATCH_ID", "local")
CSV_BUCKET = os.environ.get("CSV_BUCKET", "batch-uploads")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def log(batch_id: str, eid: str, level: str, message: str) -> None:
    if supabase:
        try:
            supabase.table("batch_logs").insert({
                "batch_id": batch_id,
                "eid": eid,
                "level": level,
                "message": message,
            }).execute()
        except Exception as e:
            print(f"Failed to log to Supabase: {e}")

def push_result(batch_id: str, eid: str, status: str) -> None:
    if supabase:
        try:
            # Update batch status and counters
            if status == 'PASS':
                supabase.rpc('increment_batch_success', {'batch_id': batch_id}).execute()
            else:
                supabase.rpc('increment_batch_failure', {'batch_id': batch_id}).execute()
            
            # Insert/update esim result
            supabase.table("esim_results").upsert({
                "batch_id": batch_id,
                "eid": eid,
                "error_message": "Processing failed" if status == 'FAIL' else None,
            }).execute()
        except Exception as e:
            print(f"Failed to push result to Supabase: {e}")

def safe_print(message: str, eid: str = "", level: str = "INFO") -> None:
    """Thread-safe print helper that also logs to Supabase."""
    with print_lock:
        print(message, flush=True)
    if supabase:
        log(BATCH_ID, eid, level, message)

def read_output(process, idx, eid):
    # Read stdout
    for line in process.stdout:
        text = line.rstrip()
        if text:
            safe_print(f"[Worker #{idx + 1}: EID {eid}] -> {text}", eid=eid)
        else:
            safe_print(f"[Worker #{idx + 1}: EID {eid}] ->", eid=eid)
    # Read stderr
    for line in process.stderr:
        text = line.rstrip()
        if text:
            safe_print(f"[Worker #{idx + 1}: EID {eid} ERROR] -> {text}", eid=eid, level="ERROR")
        else:
            safe_print(f"[Worker #{idx + 1}: EID {eid} ERROR] ->", eid=eid, level="ERROR")

def claim_next_batch() -> Optional[dict]:
    """Atomically fetch the next PENDING batch and mark it RUNNING."""
    if not supabase:
        return None
    try:
        # Attempt RPC first if available
        resp = supabase.rpc('claim_next_batch').execute()
        if resp and resp.data:
            return resp.data if isinstance(resp.data, dict) else resp.data[0]
    except Exception as e:
        safe_print(f"RPC claim_next_batch failed: {e}", level="ERROR")

    try:
        resp = (
            supabase
            .table('batches')
            .update({'status': 'RUNNING', 'updated_at': 'now()'})
            .eq('status', 'PENDING')
            .order('created_at')
            .limit(1)
            .execute()
        )
        if resp and resp.data:
            return resp.data[0]
    except Exception as e:
        safe_print(f"Failed to claim next batch: {e}", level="ERROR")
    return None

def download_batch_csv(batch_id: str) -> Optional[str]:
    """Download the batch CSV from Supabase storage and return local path."""
    if not supabase:
        return None
    try:
        data = supabase.storage.from_(CSV_BUCKET).download(f"{batch_id}.csv")
        local_path = os.path.join(os.getcwd(), f"{batch_id}.csv")
        with open(local_path, 'wb') as f:
            f.write(data)
        return local_path
    except Exception as e:
        safe_print(f"Failed to download CSV for batch {batch_id}: {e}", level="ERROR")
        return None

def update_batch_status(batch_id: str, status: str):
    if supabase:
        try:
            updates = {"status": status, "updated_at": "now()"}
            if status == "COMPLETED":
                updates["completed_at"] = "now()"
            supabase.table("batches").update(updates).eq("id", batch_id).execute()
        except Exception as e:
            print(f"Failed to update batch status: {e}")

def main():
    global BATCH_ID

    # If no specific batch ID provided, try to claim the next one
    if BATCH_ID == "local" and supabase:
        batch = claim_next_batch()
        if not batch:
            safe_print("No pending batches found.")
            return
        BATCH_ID = batch.get("id")

    # Update batch status to RUNNING
    update_batch_status(BATCH_ID, "RUNNING")

    # Get the directory where the script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))

    eids_file = os.path.join(script_dir, 'eids_US.csv')
    # If using Supabase, download the CSV for this batch
    if supabase:
        downloaded = download_batch_csv(BATCH_ID)
        if downloaded:
            eids_file = downloaded

    # Read EIDs from CSV
    eids = []
    with open(eids_file, 'r') as file:
        csv_reader = csv.reader(file)
        for row in csv_reader:
            if row:
                eids.append(row[0].strip())

    # Path to TealUS.py (assuming it's in the same directory)
    tealus_path = os.path.join(script_dir, 'TealUS.py')

    # Start subprocesses for each EID
    processes = []
    for idx, eid in enumerate(eids):
        process = subprocess.Popen(
            [sys.executable, tealus_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            cwd=script_dir,
            env={**os.environ, 'BATCH_ID': BATCH_ID, 'EID': eid}
        )
        # Pass the EID to the subprocess
        process.stdin.write(f"{eid}\n")
        process.stdin.flush()
        process.stdin.close()

        # Start a thread to read the output
        t = threading.Thread(target=read_output, args=(process, idx, eid))
        t.start()
        processes.append((process, eid, t))

    # Dictionary to store results
    results = {}

    # Wait for all processes to finish
    for process, eid, t in processes:
        return_code = process.wait()
        t.join()
        status = 'PASS' if return_code == 0 else 'FAIL'
        results[eid] = status
        push_result(BATCH_ID, eid, status)

    # Update batch status to COMPLETED
    update_batch_status(BATCH_ID, "COMPLETED")
    if supabase and eids_file != os.path.join(script_dir, 'eids_US.csv'):
        try:
            os.remove(eids_file)
        except OSError:
            pass

    # Print out the results
    safe_print("\nSummary of EID Processing:")
    for eid, status in results.items():
        safe_print(f"{eid}: {status}", eid=eid)

if __name__ == '__main__':
    main()
