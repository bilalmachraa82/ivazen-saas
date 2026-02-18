import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PushRequest {
  userId?: string;
  userIds?: string[];
  title: string;
  body: string;
  type: 'deadline' | 'pending_invoices' | 'new_upload' | 'test';
  data?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação obrigatória' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await authSupabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for DB operations (reading other users' subscriptions)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { userId, userIds, title, body, type, data }: PushRequest = await req.json();

    console.log(`Sending push notification: ${type} - ${title} (by user ${user.id})`);

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
