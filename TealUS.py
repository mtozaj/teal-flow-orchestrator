import uuid
import requests
import time
import datetime
import sys
import os
import pandas as pd

API_KEY = "d78far6ZuKvKp6G6K9hXyu3KXfo6843XSx7jFWNC01nztJi2kxMti6jCncGNO533bTZhsTW5wWqnvlKCvfQnxrygmCGHWjRLi3eY"
API_SECRET = "SJyHaTyIk6fIe43dLAkM5TlKPJsjoiOJwY86L3avIu4UZ0GEmoKHcuGYtoGh1wfLQAhpPPnTAyAeOZruZ9QYoJ3IWxFR2GQuh0t5"

BASE_URL = 'https://integrationapi.teal.global/api/v1'
HEADERS = {
    'ApiKey': API_KEY,
    'ApiSecret': API_SECRET,
    'Content-Type': 'application/json'
}

# Callback URL
CALLBACK_URL = 'https://sqs.us-east-2.amazonaws.com/404383143741/liveu-api-notification-queue-prod'

def already_active(eid: str, plan_uuid: str) -> bool:
    """
    True  ➜  SIM already has this plan *active* – we can skip.
    False ➜  Plan missing or inactive – we still need to run assign-plan.
    """
    rid = generate_request_id()
    info_op = get_esim_info(eid, rid)
    # we need the finished operation-result
    time.sleep(30)
    info = get_operation_result(rid)
    if not info or not info.get("entries"):
        return False                       # can’t prove it’s active – don’t skip

    cp_entries = info["entries"][0].get("connectionProfileEntries", [])
    return any(
        cp.get("planUuid") == plan_uuid and cp.get("active") is True
        for cp in cp_entries
    )

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

def get_esim_info(eid, request_id):
    url = f'{BASE_URL}/esims/info'
    params = {
        'callbackUrl': CALLBACK_URL,
        'limit': 1,
        'requestId': request_id,
        'eid': eid
    }
    # API call
    response = requests.get(url, headers=HEADERS, params=params)
    if response.status_code != 200:
        raise Exception(f"eSIM info API call failed with status code {response.status_code}")
    result = response.json()
    if not result.get('success'):
        raise Exception("eSIM info request failed: success != true")
    return result

def assign_plan(eid, plan_uuid):
    request_id = generate_request_id()
    url = f'{BASE_URL}/esims/assign-plan'
    params = {
        'requestId': request_id,
        'callbackUrl': CALLBACK_URL
    }
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

    request_id_query_status = generate_request_id()
    esim_info_request_result = get_esim_info(eid, request_id_query_status)

    print("Waiting for 30 seconds...")
    time.sleep(30)

    esim_info_result = get_operation_result(request_id_query_status)
    if not esim_info_result:
        raise Exception("Failed to retrieve eSIM info operation result.")

    entries = esim_info_result.get('entries', [])
    if not entries:
        raise Exception("No entries in eSIM info operation result")

    esim_entry = entries[0]
    device_status = esim_entry.get('deviceStatus')

    if device_status != "ONLINE":
        print(f"Device status is '{device_status}'. Starting loop to check device status...")
        max_retries = 4
        for attempt in range(max_retries):
            print(f"Attempt {attempt + 1} of {max_retries}")
            print("Waiting for 2 minutes...")

            time.sleep(120)

            request_id_loop_status = generate_request_id()
            esim_info_request_result = get_esim_info(eid, request_id_loop_status)
            print("Waiting for 30 seconds...")
            time.sleep(30)
            esim_info_result = get_operation_result(request_id_loop_status)
            if not esim_info_result:
                raise Exception("Failed to retrieve eSIM info operation result.")
            entries = esim_info_result.get('entries', [])
            if not entries:
                raise Exception("No entries in eSIM info operation result")
            esim_entry = entries[0]
            device_status = esim_entry.get('deviceStatus')
            if device_status == "ONLINE":
                print("Device status is now ONLINE.")
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

    # List of plan UUIDs (profiles)
    plans = [
        {'name': 'TMO', 'uuid': 'cda438862b284bcdaec82ee516eada14'},
        {'name': 'Verizon', 'uuid': '3c8fbbbc3ab442b8bc2f244c5180f9d1'},
        {'name': 'Global', 'uuid': '493bdfc2eccb415ea63796187f830784'},
        {'name': 'ATT', 'uuid': 'cd27b630772d4d8f915173488b7bfcf1'}
    ]

    # Initialize results dictionary with all expected keys
    results = {
        'EID': eid,
        'Activation Request ID': None,
        'Error': None,
    }

    for plan in plans:
        plan_name = plan['name']
        results[f"{plan_name} ICCID"] = None
        results[f"{plan_name} Status"] = None
        results[f"{plan_name} Timestamp"] = None
        results[f"{plan_name} Plan Request ID"] = None

    try:
        # Activate eSIM
        request_id = activate_esim(eid)
        results['Activation Request ID'] = request_id
        print(f"Activation initiated with request ID: {request_id}")

        # Poll for activation result
        print("Polling for activation result...")
        print("Waiting for 30 seconds.")
        time.sleep(30)
        activation_result = None
        max_wait_time = 300  # Maximum wait time in seconds (5 minutes)
        poll_interval = 10   # Poll every 10 seconds
        elapsed_time = 0

        while elapsed_time < max_wait_time:
            activation_result = get_operation_result(request_id)
            if activation_result:
                break
            time.sleep(poll_interval)
            elapsed_time += poll_interval

        if not activation_result or not activation_result.get('success'):
            # --------------------------------------------------------------------------
            #---------------------------------------------------------------------------
            # EXIT HERE RECORD FAILURE IN THE EXCEL FILE OUTPUT WITH EID, WHERE/WHY IT FAILED, and REQUEST ID
            print("Activation failed or timed out.")
            # Record failure in the output
            results['Error'] = "Activation failed or timed out."
            # Write to CSV and exit
            output_file = 'teal_output_US.csv'
            file_exists = os.path.isfile(output_file)
            df = pd.DataFrame([results])
            df.to_csv(output_file, mode='a', index=False, header=not file_exists)
            sys.exit(1)
            # --------------------------------------------------------------------------
            # --------------------------------------------------------------------------
        else:
            print("Activation request successful.")

        # Check if eSIM is active
        print("Requesting eSIM info to check if eSIM is active...")
        request_id_query = generate_request_id()
        esim_info_request_result = get_esim_info(eid, request_id_query)

        print("Waiting for 30 seconds...")
        time.sleep(30)

        esim_info_result = get_operation_result(request_id_query)

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
            max_retries = 8
            for attempt in range(max_retries):
                print(f"Attempt {attempt+1} of {max_retries}")
                print("Waiting for 2 minutes...")

                time.sleep(120)

                request_id_loop = generate_request_id()
                esim_info_request_result = get_esim_info(eid, request_id_loop)
                print("Waiting for 30 seconds...")
                time.sleep(30)

                esim_info_result = get_operation_result(request_id_loop)

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
                    break
                else:
                    print()
                    print("eSIM is still not active.")
            else:
                raise Exception("SIM not active")
        else:
            print()
            print("eSIM is active.")

        # ---------------------PLAN ASSIGNMENT BELOW---------------------

        # Now assign each plan in the list
        for plan in plans:
            plan_name = plan['name']
            plan_uuid = plan['uuid']

            # --- NEW : skip if this profile is already active -------------
            if already_active(eid, plan_uuid):
                print(f"{eid}: plan '{plan_name}' already SUCCESS – skipping")
                results[f"{plan_name} ICCID"] = "Already active"
                results[f"{plan_name} Status"] = "SUCCESS"
                results[f"{plan_name} Timestamp"] = datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')
                continue  # jump to next plan
            # ---------------------------------------------------------------

            # Check that the device is ONLINE before each plan assignment
            check_device_status(eid)

            max_plan_attempts = 4
            plan_assignment_successful = False
            # Outer loop for plan assignment retry
            for plan_attempt in range(1, max_plan_attempts + 1):
                print()
                print(f"Plan assignment attempt {plan_attempt} for plan '{plan_name}'")

                # Initiate plan assignment
                assign_plan_request_id = assign_plan(eid, plan_uuid)
                results[f"{plan_name} Plan Request ID"] = assign_plan_request_id
                print(f"Plan assignment initiated with request ID: {assign_plan_request_id}")

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
                request_id_plan_check = generate_request_id()
                esim_info_request_result = get_esim_info(eid, request_id_plan_check)

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
                    plan_assignment_successful = True
                    break

                # If it's FAILURE, then this attempt failed.
                elif plan_change_status == "FAILURE":
                    print("Plan change status returned FAILURE.")
                    # If we're on the last attempt, exit.
                    if plan_attempt == max_plan_attempts:
                        results['Error'] = f"Plan change FAILURE for plan '{plan_name}' after {plan_attempt} attempts."
                        results[f"{plan_name} ICCID"] = 'N/A'
                        results[f"{plan_name} Status"] = 'Plan change failed or timed out.'
                        results[f"{plan_name} Timestamp"] = 'N/A'
                        output_file = 'teal_output_US.csv'
                        file_exists = os.path.isfile(output_file)
                        df = pd.DataFrame([results])
                        df.to_csv(output_file, mode='a', index=False, header=not file_exists)
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

                        request_id_nested = generate_request_id()
                        esim_info_request_result = get_esim_info(eid, request_id_nested)
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
                            nested_success = True
                            plan_assignment_successful = True
                            break
                        elif plan_change_status == "FAILURE":
                            print("Plan change status returned FAILURE during nested check.")
                            break  # Exit nested loop; will retry the outer loop
                        else:
                            print("Plan change status still indeterminate.")
                    if nested_success:
                        break  # Break out of the outer loop since assignment succeeded
                    else:
                        print("Nested check did not achieve SUCCESS; retrying plan assignment...")
                        continue  # Retry the outer loop

            # If after all outer attempts the assignment is still not successful, exit with an error.
            if not plan_assignment_successful:
                results['Error'] = f"Plan change failed or timed out for plan '{plan_name}' after {max_plan_attempts} attempts."
                results[f"{plan_name} ICCID"] = 'N/A'
                results[f"{plan_name} Status"] = 'Plan change failed or timed out.'
                results[f"{plan_name} Timestamp"] = 'N/A'
                output_file = 'teal_output_US.csv'
                file_exists = os.path.isfile(output_file)
                df = pd.DataFrame([results])
                df.to_csv(output_file, mode='a', index=False, header=not file_exists)
                sys.exit(1)

            # Upon a successful assignment, store the resulting data.
            ICCID = esim_entry.get('iccid')
            Status = plan_change_status
            last_connected_network = esim_entry.get('lastConnectedNetwork', {})
            Timestamp = last_connected_network.get('lastCdrNetworkConsumptionTime')
            if not Timestamp:
                Timestamp = datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')
            results[f"{plan_name} ICCID"] = ICCID
            results[f"{plan_name} Status"] = Status
            results[f"{plan_name} Timestamp"] = Timestamp

            print(f"Plan '{plan_name}' assigned successfully:")
            print(f"ICCID: {ICCID}")
            print(f"Status: {Status}")
            print(f"Timestamp: {Timestamp}")

        # Finish
        print()
        print("All plans assigned successfully.")

        # Prepare DataFrame with data in a single row
        df = pd.DataFrame([results])

        pd.set_option('display.max_columns', None)  # Display all columns

        print(df.to_string(index=False))

        output_file = 'teal_output_US.csv'

        # Check if the file exists to decide if headers are needed
        file_exists = os.path.isfile(output_file)

        # Write or append to the CSV file
        df.to_csv(output_file, mode='a', index=False, header=not file_exists)

    except Exception as e:
        print(f"Error: {e}")

        # Record the error in results
        results['Error'] = str(e)

        # Write to CSV
        output_file = 'teal_output_US.csv'
        file_exists = os.path.isfile(output_file)
        df = pd.DataFrame([results])
        df.to_csv(output_file, mode='a', index=False, header=not file_exists)
        sys.exit(1)

if __name__ == '__main__':
    main()
