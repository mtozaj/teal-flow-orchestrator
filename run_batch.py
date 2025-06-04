
#!/usr/bin/env python3
import os
import sys
import subprocess
import argparse
from supabase import create_client, Client

def main():
    parser = argparse.ArgumentParser(description='Run eSIM batch processing')
    parser.add_argument('batch_id', help='Batch ID to process')
    parser.add_argument('--service-key', help='Supabase service role key', 
                       default=os.environ.get('SUPABASE_SERVICE_ROLE_KEY'))
    
    args = parser.parse_args()
    
    if not args.service_key:
        print("Error: SUPABASE_SERVICE_ROLE_KEY environment variable or --service-key argument required")
        sys.exit(1)
    
    # Set environment variables for the processor
    env = os.environ.copy()
    env['BATCH_ID'] = args.batch_id
    env['SUPABASE_SERVICE_ROLE_KEY'] = args.service_key
    
    # Run the parallel processor
    try:
        subprocess.run([sys.executable, 'ParallelProcessor_US.py'], env=env, check=True)
        print(f"Batch {args.batch_id} processing completed successfully")
    except subprocess.CalledProcessError as e:
        print(f"Batch {args.batch_id} processing failed with return code {e.returncode}")
        sys.exit(1)

if __name__ == '__main__':
    main()
