
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessBatchRequest {
  batchId: string;
  apiKey: string;
  apiSecret: string;
  planUuids: {
    tmo: string;
    verizon: string;
    global: string;
    att: string;
  };
}

// Generate a UUID and remove hyphens, return first 32 characters
function generateRequestId(): string {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 32);
}

async function makeApiRequest(url: string, options: RequestInit, apiKey: string, apiSecret: string) {
  const headers = {
    'ApiKey': apiKey,
    'ApiSecret': apiSecret,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    throw new Error(`API call failed with status ${response.status}`);
  }

  return response.json();
}

async function activateEsim(eid: string, apiKey: string, apiSecret: string): Promise<string> {
  const requestId = generateRequestId();
  const url = 'https://integrationapi.teal.global/api/v1/esims/activate';
  
  const params = new URLSearchParams({
    requestId,
    callbackUrl: 'https://sqs.us-east-2.amazonaws.com/404383143741/liveu-api-notification-queue-prod'
  });

  const payload = {
    entries: [eid]
  };

  const result = await makeApiRequest(`${url}?${params}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }, apiKey, apiSecret);

  if (!result.success) {
    throw new Error('Activation failed: success != true');
  }

  return requestId;
}

async function getOperationResult(requestId: string, apiKey: string, apiSecret: string) {
  const url = 'https://integrationapi.teal.global/api/v1/operation-result';
  const params = new URLSearchParams({ requestId });

  const response = await fetch(`${url}?${params}`, {
    headers: {
      'ApiKey': apiKey,
      'ApiSecret': apiSecret,
    }
  });

  if (response.status === 102) {
    return null; // Still processing
  }

  if (!response.ok) {
    throw new Error(`Operation result API call failed with status ${response.status}`);
  }

  return response.json();
}

async function getEsimInfo(eid: string, requestId: string, apiKey: string, apiSecret: string) {
  const url = 'https://integrationapi.teal.global/api/v1/esims/info';
  const params = new URLSearchParams({
    callbackUrl: 'https://sqs.us-east-2.amazonaws.com/404383143741/liveu-api-notification-queue-prod',
    limit: '1',
    requestId,
    eid
  });

  const result = await makeApiRequest(`${url}?${params}`, {
    method: 'GET'
  }, apiKey, apiSecret);

  if (!result.success) {
    throw new Error('eSIM info request failed: success != true');
  }

  return result;
}

async function assignPlan(eid: string, planUuid: string, apiKey: string, apiSecret: string): Promise<string> {
  const requestId = generateRequestId();
  const url = 'https://integrationapi.teal.global/api/v1/esims/assign-plan';
  
  const params = new URLSearchParams({
    requestId,
    callbackUrl: 'https://sqs.us-east-2.amazonaws.com/404383143741/liveu-api-notification-queue-prod'
  });

  const payload = {
    entries: [{
      eid,
      planUuid
    }]
  };

  const result = await makeApiRequest(`${url}?${params}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }, apiKey, apiSecret);

  if (!result.success) {
    throw new Error('Plan assignment failed: success != true');
  }

  return requestId;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processEsim(eid: string, planUuids: any, apiKey: string, apiSecret: string, supabase: any, batchId: string) {
  console.log(`Starting processing for EID: ${eid}`);
  
  try {
    // Step 1: Activate eSIM
    const activationRequestId = await activateEsim(eid, apiKey, apiSecret);
    await supabase.table("esim_results").upsert({
      batch_id: batchId,
      eid,
      activation_request_id: activationRequestId
    });

    console.log(`Activation initiated for ${eid} with request ID: ${activationRequestId}`);

    // Wait and poll for activation result
    await sleep(30000); // 30 seconds
    let activationResult = null;
    const maxWaitTime = 300000; // 5 minutes
    const pollInterval = 10000; // 10 seconds
    let elapsed = 0;

    while (elapsed < maxWaitTime) {
      activationResult = await getOperationResult(activationRequestId, apiKey, apiSecret);
      if (activationResult) break;
      await sleep(pollInterval);
      elapsed += pollInterval;
    }

    if (!activationResult?.success) {
      throw new Error('Activation failed or timed out');
    }

    console.log(`Activation successful for ${eid}`);

    // Step 2: Check if eSIM is active
    let isActive = false;
    const maxRetries = 8;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const infoRequestId = generateRequestId();
      await getEsimInfo(eid, infoRequestId, apiKey, apiSecret);
      await sleep(30000);
      
      const infoResult = await getOperationResult(infoRequestId, apiKey, apiSecret);
      if (infoResult?.entries?.[0]?.active) {
        isActive = true;
        break;
      }
      
      if (attempt < maxRetries - 1) {
        console.log(`eSIM ${eid} not active yet, waiting 2 minutes...`);
        await sleep(120000); // 2 minutes
      }
    }

    if (!isActive) {
      throw new Error('eSIM not active after maximum retries');
    }

    console.log(`eSIM ${eid} is now active`);

    // Step 3: Assign plans
    const plans = [
      { name: 'TMO', uuid: planUuids.tmo },
      { name: 'Verizon', uuid: planUuids.verizon },
      { name: 'Global', uuid: planUuids.global },
      { name: 'ATT', uuid: planUuids.att }
    ];

    for (const plan of plans) {
      console.log(`Assigning ${plan.name} plan to ${eid}`);
      
      // Check device status before plan assignment
      const statusRequestId = generateRequestId();
      await getEsimInfo(eid, statusRequestId, apiKey, apiSecret);
      await sleep(30000);
      
      const statusResult = await getOperationResult(statusRequestId, apiKey, apiSecret);
      const deviceStatus = statusResult?.entries?.[0]?.deviceStatus;
      
      if (deviceStatus !== 'ONLINE') {
        console.log(`Device ${eid} status is ${deviceStatus}, waiting for ONLINE status...`);
        // Wait for device to come online (simplified for this implementation)
        await sleep(120000);
      }

      // Assign plan
      const planRequestId = await assignPlan(eid, plan.uuid, apiKey, apiSecret);
      await supabase.table("esim_results").upsert({
        batch_id: batchId,
        eid,
        [`${plan.name.toLowerCase()}_plan_request_id`]: planRequestId
      });

      await sleep(30000);
      
      const planResult = await getOperationResult(planRequestId, apiKey, apiSecret);
      if (!planResult?.success) {
        throw new Error(`Plan assignment failed for ${plan.name}`);
      }

      console.log(`Plan assignment API call successful for ${plan.name}`);
      await sleep(240000); // Wait 4 minutes

      // Check plan change status
      const checkRequestId = generateRequestId();
      await getEsimInfo(eid, checkRequestId, apiKey, apiSecret);
      await sleep(30000);
      
      const checkResult = await getOperationResult(checkRequestId, apiKey, apiSecret);
      const planChangeStatus = checkResult?.entries?.[0]?.planChangeStatus;
      const iccid = checkResult?.entries?.[0]?.iccid;
      
      if (planChangeStatus === 'SUCCESS') {
        await supabase.table("esim_results").upsert({
          batch_id: batchId,
          eid,
          [`${plan.name.toLowerCase()}_iccid`]: iccid,
          [`${plan.name.toLowerCase()}_status`]: planChangeStatus,
          [`${plan.name.toLowerCase()}_timestamp`]: new Date().toISOString()
        });
        console.log(`${plan.name} plan assigned successfully to ${eid}`);
      } else {
        throw new Error(`Plan change status was ${planChangeStatus} for ${plan.name}`);
      }
    }

    // Mark as successful
    await supabase.rpc('increment_batch_success', { batch_id: batchId });
    console.log(`Successfully processed all plans for ${eid}`);

  } catch (error) {
    console.error(`Error processing ${eid}:`, error);
    await supabase.table("esim_results").upsert({
      batch_id: batchId,
      eid,
      error_message: error instanceof Error ? error.message : String(error)
    });
    await supabase.rpc('increment_batch_failure', { batch_id: batchId });
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { batchId, apiKey, apiSecret, planUuids }: ProcessBatchRequest = await req.json();

    if (!batchId || !apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get batch details and EIDs
    const { data: batch, error: batchError } = await supabaseClient
      .from('batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return new Response(
        JSON.stringify({ error: 'Batch not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download CSV from storage if file_path exists
    let eids: string[] = [];
    if (batch.file_path) {
      try {
        const { data: csvData } = await supabaseClient.storage
          .from('batch-uploads')
          .download(batch.file_path);
        
        if (csvData) {
          const text = await csvData.text();
          eids = text.split('\n').map(line => line.trim()).filter(line => line);
        }
      } catch (error) {
        console.error('Error downloading CSV:', error);
      }
    }

    if (eids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No EIDs found in batch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update batch status to RUNNING
    await supabaseClient
      .from('batches')
      .update({ status: 'RUNNING', updated_at: new Date().toISOString() })
      .eq('id', batchId);

    // Process EIDs (simplified - in production you'd want to limit concurrency)
    const processingPromises = eids.slice(0, Math.min(eids.length, 5)).map(eid => 
      processEsim(eid, planUuids, apiKey, apiSecret, supabaseClient, batchId)
    );

    // Use background task to handle processing
    EdgeRuntime.waitUntil(
      Promise.all(processingPromises).then(async () => {
        // Update batch status to COMPLETED
        await supabaseClient
          .from('batches')
          .update({ 
            status: 'COMPLETED', 
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', batchId);
        
        console.log(`Batch ${batchId} processing completed`);
      }).catch(async (error) => {
        console.error(`Batch ${batchId} processing failed:`, error);
        await supabaseClient
          .from('batches')
          .update({ 
            status: 'FAILED',
            updated_at: new Date().toISOString()
          })
          .eq('id', batchId);
      })
    );

    return new Response(
      JSON.stringify({ success: true, message: 'Batch processing started' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-batch function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
