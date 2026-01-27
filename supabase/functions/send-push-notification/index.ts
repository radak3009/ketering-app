import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
}

// Simple VAPID JWT generation
async function generateVAPIDJWT(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<string> {
  const urlObj = new URL(endpoint);
  const audience = `${urlObj.protocol}//${urlObj.host}`;
  
  // For now, we'll use a simpler approach - just sending the payload directly
  // Real web push encryption is complex and typically uses a library like web-push
  console.log("Generating VAPID for audience:", audience);
  console.log("Using public key:", vapidPublicKey.substring(0, 20) + "...");
  
  return `vapid t=placeholder, k=${vapidPublicKey}`;
}

async function sendPushNotification(
  subscription: Subscription,
  payload: PushPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    // Web Push requires proper encryption - for now we'll log and simulate
    // In production, you'd use a proper web-push library or implement full encryption
    console.log(`Would send push to ${subscription.user_id}:`, payload);
    
    // Note: Real web push requires:
    // 1. ECDH key exchange with user's p256dh key
    // 2. AES-GCM encryption of payload
    // 3. VAPID JWT signing
    
    // For proper implementation, consider using edge-compatible web-push library
    // or calling an external service
    
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "TTL": "86400",
        "Urgency": "normal",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Push failed for ${subscription.user_id}:`, response.status, text);
      
      // If subscription is invalid (404 or 410), remove it
      if (response.status === 404 || response.status === 410) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);
        console.log(`Removed invalid subscription for ${subscription.user_id}`);
      }
      
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }

    return { success: true };
  } catch (error) {
    console.error(`Push error for ${subscription.user_id}:`, error);
    return { success: false, error: String(error) };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const userIds = body.userIds as string[] | undefined;
    const payload = body.payload as PushPayload;

    console.log("Sending push notifications...", { 
      userIdsCount: userIds?.length || "all", 
      payload 
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get subscriptions
    let query = supabase.from("push_subscriptions").select("*");
    
    if (userIds && userIds.length > 0) {
      query = query.in("user_id", userIds);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error("Error fetching subscriptions:", error);
      throw error;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No subscriptions found");
      return new Response(
        JSON.stringify({ success: true, sent: 0, total: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions`);

    // Send notifications
    const results = await Promise.all(
      subscriptions.map((sub) => sendPushNotification(sub as Subscription, payload))
    );

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`Sent ${successCount}/${subscriptions.length} push notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        total: subscriptions.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in send-push-notification:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
