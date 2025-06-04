import os
import subprocess
import csv
import threading
import sys

# Lock to synchronize console output from multiple threads
print_lock = threading.Lock()

def safe_print(message: str) -> None:
    """Thread-safe print helper."""
    with print_lock:
        print(message, flush=True)

def read_output(process, idx, eid):
    # Read stdout
    for line in process.stdout:
        text = line.rstrip()
        if text:
            safe_print(f"[Worker #{idx + 1}: EID {eid}] -> {text}")
        else:
            safe_print(f"[Worker #{idx + 1}: EID {eid}] ->")
    # Read stderr
    for line in process.stderr:
        text = line.rstrip()
        if text:
            safe_print(f"[Worker #{idx + 1}: EID {eid} ERROR] -> {text}")
        else:
            safe_print(f"[Worker #{idx + 1}: EID {eid} ERROR] ->")

def main():
    # Get the directory where the script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Path to the CSV file (assuming it's in the same directory)
    eids_file = os.path.join(script_dir, 'eids_US.csv')

    # Read EIDs from CSV
    eids = []
    with open(eids_file, 'r') as file:
        csv_reader = csv.reader(file)
        for row in csv_reader:
            if row:  # Make sure it's not an empty row
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
            cwd=script_dir  # Set the working directory
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

    # Print out the results
    print("\nSummary of EID Processing:")
    for eid, status in results.items():
        print(f"{eid}: {status}")

if __name__ == '__main__':
    main()
