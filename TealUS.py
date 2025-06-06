import uuid
import requests
import time
import datetime
import sys
import os
from supabase import create_client, Client

# Teal API credentials - can be from environment or hardcoded for testing
API_KEY = os.environ.get("TEAL_API_KEY",
                         "d78farxW274ITl1EwVaRYAhQcfhYSKIpttZBavjzA24YIm2vW7q49CIQ1Q9OGBPBfW17VeQBo9MKSCnOSgf6p1Eqg17U95D5DxCW")
API_SECRET = os.environ.get("TEAL_API_SECRET",
                            "2uMopWtslrELG30loy11SxmFCBbSXNnwHB5yTT3zO3ybyQHoI9bu8OONzpOwdveexWaXzvOclcJnvLffHKlP8chzG5TGVpdaoHLD")

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://sciftjvjlpemhkvtokhi.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY",
                                           "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaWZ0anZqbHBlbWhrdnRva2hpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTA2MzY1MCwiZXhwIjoyMDY0NjM5NjUwfQ.qBvYsgv7HOwAbgtBxNO3AzRLmIMiTZKHpkJ3cqS1ngE")
BATCH_ID = os.environ.get("BATCH_ID", "local")

# Initialize Supabase client
supabase: Client | None = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    print(f"Supabase client initialized for batch: {BATCH_ID}")
else:
    print("Warning: Supabase credentials not found. Database operations will be skipped.")

BASE_URL = 'https://integrationapi.teal.global/api/v1'
HEADERS = {
    'ApiKey': API_KEY,
    'ApiSecret': API_SECRET,
    'Content-Type': 'application/json'
}

# Callback URL
CALLBACK_URL = 'https://sqs.us-east-2.amazonaws.com/404383143741/liveu-api-notification-queue-prod'


def insert_batch_log(level: str, message: str, eid: str = None) -> None:
    """Insert a log row into batch_logs for the current batch."""
    if not supabase or not BATCH_ID or BATCH_ID == "local":
        return

    log_row = {
        'batch_id': BATCH_ID,
        'level': level,
        'message': message,
        'timestamp': datetime.datetime.utcnow().isoformat()
    }
    if eid:
        log_row['eid'] = eid

    try:
        supabase.table('batch_logs').insert(log_row).execute()
    except Exception as exc:
        print(f"Failed to insert batch log: {exc}")


def update_esim_result(eid: str, data: dict) -> None:
    """Update the esim_results table with processing status."""
    if not supabase or not BATCH_ID or BATCH_ID == "local":
        return

    try:
        # Always include batch_id and eid
        data['batch_id'] = BATCH_ID
        data['eid'] = eid
        data['updated_at'] = datetime.datetime.utcnow().isoformat()

        supabase.table('esim_results').upsert(data).execute()
    except Exception as exc:
        print(f"Failed to update esim_results: {exc}")


def already_active(eid: str, plan_uuid: str) -> bool:
    """
    True  ➜  SIM already has this plan *active* – we can skip.
    False ➜  Plan missing or inactive – we still need to run assign-plan.
    """
    try:
        info_op, rid = get_esim_info(eid)

        time.sleep(30)

        info = get_operation_result(rid)
        if not info or not info.get("entries"):
            return False  # can't prove it's active – don't skip

        cp_entries = info["entries"][0].get("connectionProfileEntries", [])
        return any(
            cp.get("planUuid") == plan_uuid and cp.get("active") is True
            for cp in cp_entries
        )

    except Exception as e:
        print(f"Could not check if plan is already active: {e}")
        print("Assuming plan is not active and proceeding with assignment...")
        return False  # If we can't check, assume it's not active


# verify if the fallback profile is set to true or false
def verify_fallback_profile(eid, plan_uuid, plan_name):
    print("Fetching eSIM info to confirm profile fallback lock...")
    insert_batch_log('INFO', f"Fetching eSIM info to confirm profile fallback lock for {plan_name}", eid)

    info_json_fallback, info_req_id = get_esim_info(eid)
    print("Waiting 60 seconds")
    time.sleep(60)
    info_result = get_operation_result(info_req_id)
    if not info_result or not info_result.get("entries"):
        print("Could not retrieve eSIM info for verification.")
    else:
        entry = info_result["entries"][0]
        profiles = entry.get("connectionProfileEntries", [])
        print("Full connectionProfileEntries:")
        print(profiles)
        for cp in profiles:
            if cp.get("planUuid") == plan_uuid:
                print(f"---> Plan '{plan_name}' fallbackProfile =", cp.get("fallbackProfile"))
                break


def generate_request_id():
    # Generate a UUID and remove hyphens
    request_id = str(uuid.uuid4()).replace("-", "")
    # Return the first 32 characters to meet the limit
    return request_id[:32]


def activate_esim(eid):
    if not eid:
        raise ValueError("EID must be provided.")

    request_id = generate_request_id()
    url = f'{BASE_URL}/esims/activate'

    params = {
        'requestId': request_id,
        'callbackUrl': CALLBACK_URL
    }

    payload = {
        'entries': [eid]
    }
    response = requests.post(url, headers=HEADERS, params=params, json=payload)

    if response.status_code != 200:
        raise Exception(f"Activation API call failed with status code {response.status_code}")
    result = response.json()
    if not result.get('success'):
        raise Exception("Activation failed: success != true")

    return request_id


def get_operation_result(request_id):
    url = f'{BASE_URL}/operation-result'
    params = {'requestId': request_id}
    response = requests.get(url, headers=HEADERS, params=params)
    if response.status_code == 102:
        # Operation is still processing
        return None
    elif response.status_code != 200:
        raise Exception(f"Operation result API call failed with status code {response.status_code}")
    return response.json()


def get_esim_info(eid: str, max_retries: int = 5, delay: int = 30):
    """
    Fetches eSIM info, retrying up to `max_retries` times.
    Returns (response_json, request_id) so the caller
    knows which requestId to poll in /operation-result.
    """
    last_err = None

    for attempt in range(1, max_retries + 1):
        request_id = generate_request_id()  # NEW id each try
        params = {
            "callbackUrl": CALLBACK_URL,
            "limit": 1,
            "requestId": request_id,
            "eid": eid,
        }

        try:
            resp = requests.get(f"{BASE_URL}/esims/info",
                                headers=HEADERS, params=params, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    return data, request_id  # ← caller uses this ID
                last_err = "success != true"
            else:
                last_err = f"HTTP {resp.status_code}"
        except requests.RequestException as exc:
            last_err = str(exc)

        # back-off before next attempt
        if attempt < max_retries:
            time.sleep(delay)

    # all retries exhausted
    raise Exception(f"eSIM info request failed after {max_retries} attempts – {last_err}")


def assign_plan(eid, plan_uuid, profile_lock):
    request_id = generate_request_id()
    url = f'{BASE_URL}/esims/assign-plan'
    params = {
        'requestId': request_id,
        'callbackUrl': CALLBACK_URL
    }

    # enable the profile fallback lock if parameter is "true"
    if profile_lock == "true":
        params["lockProfile"] = "true"

    payload = {
        "entries": [
            {
                "eid": eid,
                "planUuid": plan_uuid
            }
        ]
    }

    response = requests.post(url, headers=HEADERS, params=params, json=payload)
    if response.status_code != 200:
        raise Exception(f"Assign Plan API call failed with status code {response.status_code}")
    result = response.json()
    if not result.get('success'):
        raise Exception("Plan assignment failed: success != true")
    return request_id


def check_device_status(eid):
    print()
    print("Requesting eSIM info to check device status...")
    insert_batch_log('INFO', "Checking device status...", eid)

    # request_id_query_status = generate_request_id()
    info_json, info_request_id = get_esim_info(eid)

    print("Waiting for 30 seconds...")
    time.sleep(30)

    esim_info_result = get_operation_result(info_request_id)
    if not esim_info_result:
        raise Exception("Failed to retrieve eSIM info operation result.")

    entries = esim_info_result.get('entries', [])
    if not entries:
        raise Exception("No entries in eSIM info operation result")

    esim_entry = entries[0]
    device_status = esim_entry.get('deviceStatus')

    if device_status != "ONLINE":
        print(f"Device status is '{device_status}'. Starting loop to check device status...")
        insert_batch_log('WARNING', f"Device status is '{device_status}'. Waiting for ONLINE status...", eid)
        max_retries = 4
        for attempt in range(max_retries):
            print(f"Attempt {attempt + 1} of {max_retries}")
            print("Waiting for 2 minutes...")

            time.sleep(120)

            # request_id_loop_status = generate_request_id()
            info_json, info_request_id = get_esim_info(eid)

            print("Waiting for 30 seconds...")
            time.sleep(30)

            esim_info_result = get_operation_result(info_request_id)

            if not esim_info_result:
                raise Exception("Failed to retrieve eSIM info operation result.")
            entries = esim_info_result.get('entries', [])
            if not entries:
                raise Exception("No entries in eSIM info operation result")
            esim_entry = entries[0]
            device_status = esim_entry.get('deviceStatus')
            if device_status == "ONLINE":
                print("Device status is now ONLINE.")
                insert_batch_log('INFO', "Device status is now ONLINE", eid)
                return
            else:
                print(f"Device status is still '{device_status}'.")
        else:
            raise Exception("Device Status Error before assigning plan.")
    else:
        print("Device status is ONLINE.")


def main():
    # Get EID from user input
    eid = input("").strip()

    if not eid:
        print("Error: EID must be provided.")
        sys.exit(1)

    # Log start of processing
    insert_batch_log('INFO', f"Starting processing for EID: {eid}", eid)

    # List of plan UUIDs (profiles)
    plans = [
        {'name': 'TMO', 'uuid': 'cda438862b284bcdaec82ee516eada14'},
        {'name': 'Verizon', 'uuid': '3c8fbbbc3ab442b8bc2f244c5180f9d1'},
        {'name': 'Global', 'uuid': '493bdfc2eccb415ea63796187f830784'},
        {'name': 'ATT', 'uuid': 'cd27b630772d4d8f915173488b7bfcf1'}
    ]

    # Initialize processing_started_at
    update_esim_result(eid, {
        'processing_started_at': datetime.datetime.utcnow().isoformat()
    })

    try:
        # Activate eSIM
        request_id = activate_esim(eid)
        print(f"Activation initiated with request ID: {request_id}")
        insert_batch_log('INFO', f"Activation initiated with request ID: {request_id}", eid)

        # Update activation request ID in database
        update_esim_result(eid, {
            'activation_request_id': request_id
        })

        # Poll for activation result
        print("Polling for activation result...")
        print("Waiting for 30 seconds.")
        time.sleep(30)
        activation_result = None
        max_wait_time = 300  # Maximum wait time in seconds (5 minutes)
        poll_interval = 10  # Poll every 10 seconds
        elapsed_time = 0

        while elapsed_time < max_wait_time:
            activation_result = get_operation_result(request_id)
            if activation_result:
                break
            time.sleep(poll_interval)
            elapsed_time += poll_interval

        if not activation_result or not activation_result.get('success'):
            print("Activation failed or timed out.")
            error_msg = "Activation failed or timed out."
            insert_batch_log('ERROR', error_msg, eid)
            update_esim_result(eid, {
                'error_message': error_msg,
                'processing_completed_at': datetime.datetime.utcnow().isoformat()
            })
            sys.exit(1)
        else:
            print("Activation request successful.")
            insert_batch_log('INFO', "Activation request successful", eid)

        # Check if eSIM is active
        print("Requesting eSIM info to check if eSIM is active...")
        insert_batch_log('INFO', "Checking if eSIM is active...", eid)

        info_json, info_request_id = get_esim_info(eid)

        print("Waiting for 30 seconds...")
        time.sleep(30)

        esim_info_result = get_operation_result(info_request_id)

        if not esim_info_result:
            raise Exception("Failed to retrieve eSIM info operation result.")
        entries = esim_info_result.get('entries', [])

        if not entries:
            raise Exception("No entries in eSIM info operation result")

        esim_entry = entries[0]
        print(entries)
        print()
        print("----> ACTIVE RESULT: ", esim_entry.get('active'))
        if not esim_entry.get('active'):
            print()
            print("eSIM is not active, starting loop to check activation status...")
            insert_batch_log('INFO', "eSIM is not active, starting activation check loop...", eid)
            max_retries = 16
            for attempt in range(max_retries):
                print(f"Attempt {attempt + 1} of {max_retries}")
                print("Waiting for 2 minutes...")

                time.sleep(120)

                info_json_loop, info_request_id_loop = get_esim_info(eid)

                print("Waiting for 30 seconds...")
                time.sleep(30)

                esim_info_result = get_operation_result(info_request_id_loop)

                if not esim_info_result:
                    raise Exception("Failed to retrieve eSIM info operation result.")
                entries = esim_info_result.get('entries', [])

                if not entries:
                    raise Exception("No entries in eSIM info operation result")

                esim_entry = entries[0]
                print()
                print("----> ACTIVE RESULT: ", esim_entry.get('active'))
                if esim_entry.get('active'):
                    print()
                    print("eSIM is now active.")
                    insert_batch_log('INFO', "eSIM is now active", eid)
                    break
                else:
                    print()
                    print("eSIM is still not active.")
            else:
                raise Exception("SIM not active")
        else:
            print()
            print("eSIM is active.")
            insert_batch_log('INFO', "eSIM is active", eid)

        # ---------------------PLAN ASSIGNMENT BELOW---------------------

        # Now assign each plan in the list
        for plan in plans:
            plan_name = plan['name']
            plan_uuid = plan['uuid']

            if plan_name == "ATT":
                profile_lock = "true"
            else:
                profile_lock = "false"

            # Check if plan is already active
            if already_active(eid, plan_uuid):
                print(f"{eid}: plan '{plan_name}' already installed - skipping")
                insert_batch_log('INFO', f"Plan '{plan_name}' already installed - skipping", eid)

                # Update database with already active status
                update_data = {
                    f"{plan_name.lower()}_status": "SUCCESS",
                    f"{plan_name.lower()}_timestamp": datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')
                }
                if plan_name.lower() == 'att':
                    update_data['att_iccid'] = "Already active"
                else:
                    update_data[f"{plan_name.lower()}_iccid"] = "Already active"

                update_esim_result(eid, update_data)
                continue
            else:
                print(f"{eid}: plan '{plan_name}' not installed - proceeding with assignment")
                insert_batch_log('INFO', f"Plan '{plan_name}' not installed - proceeding with assignment", eid)

            # Check that the device is ONLINE before each plan assignment
            check_device_status(eid)

            max_plan_attempts = 4
            plan_assignment_successful = False
            # Outer loop for plan assignment retry
            for plan_attempt in range(1, max_plan_attempts + 1):
                print()
                print(f"Plan assignment attempt {plan_attempt} for plan '{plan_name}'")
                insert_batch_log('INFO', f"Plan assignment attempt {plan_attempt} for plan '{plan_name}'", eid)

                # Initiate plan assignment
                assign_plan_request_id = assign_plan(eid, plan_uuid, profile_lock)
                print(f"Plan assignment initiated with request ID: {assign_plan_request_id}")

                # Update plan request ID in database
                update_data = {}
                if plan_name.lower() == 'att':
                    update_data['att_plan_request_id'] = assign_plan_request_id
                else:
                    update_data[f"{plan_name.lower()}_plan_request_id"] = assign_plan_request_id
                update_esim_result(eid, update_data)

                print("Waiting for 30 seconds after plan assignment API call...")
                time.sleep(30)

                plan_result = get_operation_result(assign_plan_request_id)
                if not plan_result or not plan_result.get('success'):
                    print("Plan assignment API call did not return success; retrying the assignment...")
                    continue  # Retry the assignment

                print("Plan assignment API call returned success.")
                print("Waiting for 4 minutes before checking plan change status...")
                time.sleep(240)

                # Check planChangeStatus
                print(f"Checking planChangeStatus for '{plan_name}'...")
                esim_info_request_result, request_id_plan_check = get_esim_info(eid)

                print("Waiting for 30 seconds before retrieving plan change status...")
                time.sleep(30)
                esim_info_result = get_operation_result(request_id_plan_check)
                if not esim_info_result:
                    raise Exception("Failed to retrieve eSIM info operation result.")
                entries = esim_info_result.get('entries', [])
                if not entries:
                    raise Exception("No entries in eSIM info operation result")
                esim_entry = entries[0]
                plan_change_status = esim_entry.get('planChangeStatus')
                print(f"Initial planChangeStatus for '{plan_name}': {plan_change_status}")

                # If the status is clearly SUCCESS, we are done.
                if plan_change_status == "SUCCESS":
                    print("Plan change status is SUCCESS.")
                    insert_batch_log('INFO', f"Plan '{plan_name}' assigned successfully", eid)
                    plan_assignment_successful = True
                    verify_fallback_profile(eid, plan_uuid, plan_name)
                    break

                # If it's FAILURE, then this attempt failed.
                elif plan_change_status == "FAILURE":
                    print("Plan change status returned FAILURE.")
                    # If we're on the last attempt, exit.
                    if plan_attempt == max_plan_attempts:
                        error_msg = f"Plan change FAILURE for plan '{plan_name}' after {plan_attempt} attempts."
                        insert_batch_log('ERROR', error_msg, eid)

                        # Update database with failure
                        update_data = {
                            'error_message': error_msg,
                            'processing_completed_at': datetime.datetime.utcnow().isoformat()
                        }
                        if plan_name.lower() == 'att':
                            update_data.update({
                                'att_status': 'FAILED',
                                'att_timestamp': datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')
                            })
                        else:
                            update_data.update({
                                f"{plan_name.lower()}_status": 'FAILED',
                                f"{plan_name.lower()}_timestamp": datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')
                            })
                        update_esim_result(eid, update_data)
                        sys.exit(1)
                    else:
                        print("Retrying plan assignment due to FAILURE status...")
                        continue  # Retry outer loop

                # Otherwise, if the status is neither SUCCESS nor FAILURE,
                # enter a nested loop to recheck the status.
                else:
                    print(f"PlanChangeStatus is '{plan_change_status}'. Starting nested re-check loop...")

                    max_nested_retries = 4
                    nested_success = False
                    for nested_attempt in range(1, max_nested_retries + 1):
                        print(f"Nested check attempt {nested_attempt} of {max_nested_retries} for plan '{plan_name}'")
                        print("Waiting for 2 minutes...")

                        time.sleep(120)

                        esim_info_request_result, request_id_nested = get_esim_info(eid)
                        print("Waiting for 30 seconds before nested status check...")
                        time.sleep(30)
                        esim_info_result = get_operation_result(request_id_nested)

                        if not esim_info_result:
                            raise Exception("Failed to retrieve eSIM info operation result during nested check.")
                        entries = esim_info_result.get('entries', [])
                        if not entries:
                            raise Exception("No entries in eSIM info operation result during nested check.")
                        esim_entry = entries[0]
                        plan_change_status = esim_entry.get('planChangeStatus')
                        print(f"Nested check {nested_attempt}: planChangeStatus is '{plan_change_status}'")

                        if plan_change_status == "SUCCESS":
                            print("Plan change status is SUCCESS in nested check.")
                            insert_batch_log('INFO', f"Plan '{plan_name}' assigned successfully in nested check", eid)
                            nested_success = True
                            plan_assignment_successful = True
                            verify_fallback_profile(eid, plan_uuid, plan_name)
                            break
                        elif plan_change_status == "FAILURE":
                            print("Plan change status returned FAILURE during nested check.")
                            break  # Exit nested loop; will retry the outer loop
                        else:
                            print("Plan change status still indeterminate.")
                    if nested_success:
                        break  # Break out of the outer loop since assignment succeeded
                    else:
                        if plan_attempt < max_plan_attempts:
                            print("Nested check did not achieve SUCCESS; retrying plan assignment...")
                        else:
                            print("Nested check did not achieve SUCCESS; no more retries remaining.")
                        continue  # Retry the outer loop (or exit if no more attempts)

            # If after all outer attempts the assignment is still not successful, exit with an error.
            if not plan_assignment_successful:
                error_msg = f"Plan change failed or timed out for plan '{plan_name}' after {max_plan_attempts} attempts."
                insert_batch_log('ERROR', error_msg, eid)

                # Update database with failure
                update_data = {
                    'error_message': error_msg,
                    'processing_completed_at': datetime.datetime.utcnow().isoformat()
                }
                if plan_name.lower() == 'att':
                    update_data['att_status'] = 'FAILED'
                else:
                    update_data[f"{plan_name.lower()}_status"] = 'FAILED'
                update_esim_result(eid, update_data)
                sys.exit(1)

            # Upon a successful assignment, store the resulting data.
            ICCID = esim_entry.get('iccid')
            Status = plan_change_status
            last_connected_network = esim_entry.get('lastConnectedNetwork', {})
            Timestamp = last_connected_network.get('lastCdrNetworkConsumptionTime')
            if not Timestamp:
                Timestamp = datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')

            print(f"Plan '{plan_name}' assigned successfully:")
            print(f"ICCID: {ICCID}")
            print(f"Status: {Status}")
            print(f"Timestamp: {Timestamp}")

            # Update database with successful result
            update_data = {}
            if plan_name.lower() == 'att':
                update_data.update({
                    'att_iccid': ICCID,
                    'att_status': Status,
                    'att_timestamp': Timestamp
                })
            else:
                update_data.update({
                    f"{plan_name.lower()}_iccid": ICCID,
                    f"{plan_name.lower()}_status": Status,
                    f"{plan_name.lower()}_timestamp": Timestamp
                })
            update_esim_result(eid, update_data)

        # Finish
        print()
        print("All plans assigned successfully.")
        insert_batch_log('INFO', "All plans assigned successfully", eid)

        # Update processing completed timestamp and calculate duration
        completion_time = datetime.datetime.utcnow()
        update_esim_result(eid, {
            'processing_completed_at': completion_time.isoformat(),
            'status': 'SUCCESS'
        })

    except Exception as e:
        print(f"Error: {e}")
        error_msg = str(e)
        insert_batch_log('ERROR', error_msg, eid)

        # Update database with error
        update_esim_result(eid, {
            'error_message': error_msg,
            'processing_completed_at': datetime.datetime.utcnow().isoformat(),
            'status': 'FAILED'
        })
        sys.exit(1)


if __name__ == '__main__':
    main()
