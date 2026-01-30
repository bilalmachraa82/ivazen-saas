import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushRequest {
  userId?: string;
  userIds?: string[];
  title: string;
  body: string;
  type: 'deadline' | 'pending_invoices' | 'new_upload' | 'test';
  data?: Record<string, unknown>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { userId, userIds, title, body, type, data }: PushRequest = await req.json();

    console.log(`Sending push notification: ${type} - ${title}`);

    // Get target user IDs
    const targetUserIds = userIds || (userId ? [userId] : []);
    
    if (targetUserIds.length === 0) {
      throw new Error("No target users specified");
    }

    // Get push subscriptions for target users
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', targetUserIds);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for users');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter users by notification preferences
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('*')
      .in('user_id', targetUserIds);

    const prefsMap = new Map(preferences?.map(p => [p.user_id, p]) || []);

    // Filter subscriptions based on preferences
    const filteredSubs = subscriptions.filter(sub => {
      const prefs = prefsMap.get(sub.user_id);
      if (!prefs) return true; // Default: send all

      switch (type) {
        case 'deadline':
          return prefs.deadline_reminders;
        case 'pending_invoices':
          return prefs.pending_invoices;
        case 'new_upload':
          return prefs.new_uploads;
        case 'test':
          return true;
        default:
          return true;
      }
    });

    console.log(`Sending to ${filteredSubs.length} subscriptions (${subscriptions.length} total)`);

    // Web Push requires VAPID keys - for now, we'll log and store notification
    // In production, you would use web-push library with proper VAPID keys
    
    // Store sent notifications for tracking
    const notifications = filteredSubs.map(sub => ({
      user_id: sub.user_id,
      notification_type: type,
      title,
      body,
      reference_id: data?.referenceId as string || null,
    }));

    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('sent_notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Error storing notifications:', insertError);
      }
    }

    // For demonstration, we'll simulate sending
    // In production, implement actual Web Push API calls here
    console.log(`Notifications logged for ${notifications.length} users`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: filteredSubs.length,
        message: `Notification queued for ${filteredSubs.length} users`
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Push notification error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
