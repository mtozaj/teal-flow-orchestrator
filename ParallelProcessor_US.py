import os
import subprocess
import csv
import threading
import sys
import datetime
import pathlib
from supabase import create_client, Client

# ------------------------------------------------------------------- #
# 1)  open a dated log-file that will receive *everything* we print   #
# ------------------------------------------------------------------- #
LOGFILE = pathlib.Path(
    f"run_{datetime.datetime.now():%Y%m%d_%H%M%S}.log"
).open("a", encoding="utf-8")

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
BATCH_ID = os.environ.get("BATCH_ID", "local")

# Lock to synchronize console output from multiple threads
print_lock = threading.Lock()

# Initialize Supabase client
supabase: Client | None = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def log_to_supabase(batch_id: str, eid: str, level: str, message: str) -> None:
    """Log message to Supabase batch_logs table."""
    if supabase:
        try:
            supabase.table("batch_logs").insert({
                "batch_id": batch_id,
                "eid": eid,
                "level": level,
                "message": message,
                "timestamp": datetime.datetime.utcnow().isoformat()
            }).execute()
        except Exception as e:
            # Don't let Supabase errors break the script
            print(f"Failed to log to Supabase: {e}")

def push_result(batch_id: str, eid: str, status: str) -> None:
    """Push result to Supabase esim_results table."""
    if supabase:
        try:
            supabase.table("esim_results").upsert({
                "batch_id": batch_id,
                "eid": eid,
                "status": status,
                "updated_at": datetime.datetime.utcnow().isoformat()
            }).execute()
        except Exception as e:
            print(f"Failed to push result to Supabase: {e}")

def safe_print(message: str, eid: str = "", level: str = "INFO") -> None:
    """Thread-safe print helper that prefixes [hh:mm:ss], 
       logs to file, and logs to Supabase."""
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    line = f"[{timestamp}] {message}"
    
    with print_lock:
        print(line, flush=True)
        LOGFILE.write(line + "\n")
        LOGFILE.flush()
    
    # Also log to Supabase if available
    if supabase and eid:
        log_to_supabase(BATCH_ID, eid, level, message)

def read_output(process, idx, eid):
    # Read stdout
    for raw in process.stdout:
        text = raw.rstrip()
        safe_print(f"[Worker #{idx + 1}: EID {eid}] -> {text}", eid=eid)
    
    # Read stderr
    for raw in process.stderr:
        text = raw.rstrip()
        safe_print(f"[Worker #{idx + 1}: EID {eid} ERROR] -> {text}", eid=eid, level="ERROR")

def update_batch_status(status: str, counts: dict = None) -> None:
    """Update batch status in Supabase."""
    if supabase and BATCH_ID != "local":
        try:
            update_data = {
                "status": status,
                "updated_at": datetime.datetime.utcnow().isoformat()
            }
            
            if status == "COMPLETED" or status == "FAILED":
                update_data["completed_at"] = datetime.datetime.utcnow().isoformat()
            
            if counts:
                update_data["success_count"] = counts.get("success", 0)
                update_data["failure_count"] = counts.get("failure", 0)
            
            supabase.table("batches").update(update_data).eq("id", BATCH_ID).execute()
        except Exception as e:
            print(f"Failed to update batch status: {e}")

def main():
    # Get the directory where the script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Path to the CSV file
    eids_file = os.path.join(script_dir, 'eids_fallback.csv')

    # Read EIDs from CSV
    eids = []
    try:
        with open(eids_file, 'r', newline='') as fh:
            for row in csv.reader(fh):
                if row and row[0].strip():
                    eids.append(row[0].strip())
    except FileNotFoundError:
        safe_print(f"Error: {eids_file} not found!")
        return
    except Exception as e:
        safe_print(f"Error reading EIDs file: {e}")
        return

    if not eids:
        safe_print("No EIDs found – exiting.")
        return

    safe_print(f"Processing {len(eids)} EIDs for batch: {BATCH_ID}")
    
    # Update batch status to RUNNING
    update_batch_status("RUNNING")

    # Path to TealUS.py
    tealus_path = os.path.join(script_dir, 'TealUS_fallback.py')

    # Start subprocesses for each EID
    processes = []
    for idx, eid in enumerate(eids):
        # Create environment with batch ID
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
    success_count = 0
    failure_count = 0
    
    for process, eid, t in processes:
        return_code = process.wait()
        t.join()
        status = 'PASS' if return_code == 0 else 'FAIL'
        results[eid] = status
        
        if status == 'PASS':
            success_count += 1
        else:
            failure_count += 1
        
        # Push individual result to Supabase
        push_result(BATCH_ID, eid, status)

    # Summary
    safe_print("\nSummary of EID Processing:")
    safe_print(f"Total EIDs: {len(eids)}")
    safe_print(f"Successful: {success_count}")
    safe_print(f"Failed: {failure_count}")
    
    for eid, status in results.items():
        safe_print(f"{eid}: {status}")

    # Update batch with final status
    final_status = 'COMPLETED' if failure_count == 0 else 'FAILED'
    update_batch_status(final_status, {"success": success_count, "failure": failure_count})
    
    # Calculate and log timing
    safe_print(f"\nBatch {BATCH_ID} finished with status: {final_status}")

    LOGFILE.close()

if __name__ == '__main__':
    main()