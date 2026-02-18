import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Deadline {
  type: string;
  name: string;
  daysUntil: number;
  dueDate: string;
  urgency: 'critical' | 'warning' | 'info';
}

function getUpcomingDeadlines(): Deadline[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.ceil((currentMonth + 1) / 3);

  const deadlines: Deadline[] = [];

  // IVA Monthly - Day 20 of following month
  const ivaMonthlyDue = new Date(currentYear, currentMonth, 20);
  if (now.getDate() > 20) {
    ivaMonthlyDue.setMonth(ivaMonthlyDue.getMonth() + 1);
  }
  const ivaDaysUntil = Math.ceil((ivaMonthlyDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (ivaDaysUntil <= 14) {
    deadlines.push({
      type: 'iva_monthly',
      name: 'IVA Mensal',
      daysUntil: ivaDaysUntil,
      dueDate: ivaMonthlyDue.toISOString().split('T')[0],
      urgency: ivaDaysUntil <= 3 ? 'critical' : ivaDaysUntil <= 7 ? 'warning' : 'info',
    });
  }

  // IVA Quarterly - Until day 20 of 2nd month after quarter
  const ivaQuarterDue = new Date(currentYear, currentQuarter * 3 + 1, 20);
  if (now > ivaQuarterDue) {
    ivaQuarterDue.setMonth(ivaQuarterDue.getMonth() + 3);
  }
  const ivaQDaysUntil = Math.ceil((ivaQuarterDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (ivaQDaysUntil <= 14) {
    deadlines.push({
      type: 'iva_quarterly',
      name: `IVA Trimestral T${currentQuarter}`,
      daysUntil: ivaQDaysUntil,
      dueDate: ivaQuarterDue.toISOString().split('T')[0],
      urgency: ivaQDaysUntil <= 3 ? 'critical' : ivaQDaysUntil <= 7 ? 'warning' : 'info',
    });
  }

  // SS Quarterly - Until day 15 of 2nd month after quarter
  const ssQuarterDue = new Date(currentYear, currentQuarter * 3 + 1, 15);
  if (now > ssQuarterDue) {
    ssQuarterDue.setMonth(ssQuarterDue.getMonth() + 3);
  }
  const ssDaysUntil = Math.ceil((ssQuarterDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (ssDaysUntil <= 14) {
    deadlines.push({
      type: 'ss_quarterly',
      name: `Segurança Social T${currentQuarter}`,
      daysUntil: ssDaysUntil,
      dueDate: ssQuarterDue.toISOString().split('T')[0],
      urgency: ssDaysUntil <= 3 ? 'critical' : ssDaysUntil <= 7 ? 'warning' : 'info',
    });
  }

  // Modelo 10 - February 28 of following year
  let modelo10Due = new Date(currentYear + 1, 1, 28);
  if (currentMonth >= 2) {
    modelo10Due = new Date(currentYear + 2, 1, 28);
  }
  const modelo10DaysUntil = Math.ceil((modelo10Due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (modelo10DaysUntil <= 30) {
    deadlines.push({
      type: 'modelo10',
      name: 'Modelo 10',
      daysUntil: modelo10DaysUntil,
      dueDate: modelo10Due.toISOString().split('T')[0],
      urgency: modelo10DaysUntil <= 7 ? 'critical' : modelo10DaysUntil <= 14 ? 'warning' : 'info',
    });
  }

  return deadlines;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: accept either JWT (user call) or service role key (cron call)
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (authHeader) {
      // If there's a Bearer token, verify it's a valid JWT or the service role key
      const token = authHeader.replace('Bearer ', '');
      if (token !== serviceRoleKey) {
        const authSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
          global: { headers: { Authorization: authHeader } }
        });
        const { error: authError } = await authSupabase.auth.getUser();
        if (authError) {
          return new Response(
            JSON.stringify({ error: 'Token inválido ou expirado' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Autenticação obrigatória' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("=== Checking fiscal deadlines ===");
    console.log(`Current time: ${new Date().toISOString()}`);

    const deadlines = getUpcomingDeadlines();
    console.log(`Found ${deadlines.length} upcoming deadlines:`, deadlines.map(d => `${d.name} (${d.daysUntil} days)`));

    if (deadlines.length === 0) {
      console.log("No imminent deadlines to notify about");
      return new Response(
        JSON.stringify({ success: true, notificationsSent: 0, message: "No imminent deadlines" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all accountants (they manage clients and need deadline notifications)
    const { data: accountants, error: accError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'accountant');

    if (accError) {
      console.error('Error fetching accountants:', accError);
      throw accError;
    }

    const accountantIds = accountants?.map(a => a.user_id) || [];
    console.log(`Found ${accountantIds.length} accountants to potentially notify`);

    // Get notification preferences for accountants
    const { data: allPrefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('user_id, reminder_days, deadline_reminders')
      .eq('deadline_reminders', true)
      .in('user_id', accountantIds.length > 0 ? accountantIds : ['none']);

    if (prefsError) {
      console.error('Error fetching preferences:', prefsError);
      throw prefsError;
    }

    // Also get clients who have deadline reminders enabled
    const { data: clientPrefs, error: clientPrefsError } = await supabase
      .from('notification_preferences')
      .select('user_id, reminder_days, deadline_reminders')
      .eq('deadline_reminders', true);

    if (clientPrefsError) {
      console.error('Error fetching client preferences:', clientPrefsError);
    }

    // Combine accountant and client preferences
    const combinedPrefs = [...(allPrefs || []), ...(clientPrefs || [])];
    // Remove duplicates
    const uniquePrefs = Array.from(new Map(combinedPrefs.map(p => [p.user_id, p])).values());

    console.log(`${uniquePrefs.length} users have deadline reminders enabled`);

    if (uniquePrefs.length === 0) {
      console.log('No users with deadline reminders enabled');
      return new Response(
        JSON.stringify({ success: true, notificationsSent: 0, message: "No users with reminders enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get push subscriptions
    const { data: pushSubs, error: pushError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', uniquePrefs.map(p => p.user_id));

    if (pushError) {
      console.error('Error fetching push subscriptions:', pushError);
    }

    const pushSubsMap = new Map(pushSubs?.map(s => [s.user_id, s]) || []);
    console.log(`${pushSubs?.length || 0} users have push subscriptions`);

    let totalSent = 0;
    const today = new Date().toISOString().split('T')[0];

    // Check each deadline
    for (const deadline of deadlines) {
      // Find users who should be notified for this deadline based on their reminder_days preference
      const usersToNotify = uniquePrefs.filter(pref => {
        // Default reminder days if not set: [1, 3, 7]
        const reminderDays = pref.reminder_days?.length > 0 ? pref.reminder_days : [1, 3, 7];
        return reminderDays.includes(deadline.daysUntil);
      });

      if (usersToNotify.length === 0) {
        console.log(`No users to notify for ${deadline.name} (${deadline.daysUntil} days)`);
        continue;
      }

      console.log(`Deadline ${deadline.name}: ${deadline.daysUntil} days - ${usersToNotify.length} potential users`);

      // Check if we already sent this notification today
      const referenceId = `${deadline.type}_${deadline.dueDate}_${deadline.daysUntil}`;

      const { data: existingNotifs } = await supabase
        .from('sent_notifications')
        .select('user_id')
        .eq('reference_id', referenceId)
        .gte('sent_at', `${today}T00:00:00`);

      const alreadyNotifiedUsers = new Set(existingNotifs?.map(n => n.user_id) || []);
      const newUsersToNotify = usersToNotify.filter(u => !alreadyNotifiedUsers.has(u.user_id));

      if (newUsersToNotify.length === 0) {
        console.log(`All users already notified for ${deadline.name}`);
        continue;
      }

      console.log(`Sending to ${newUsersToNotify.length} new users for ${deadline.name}`);

      // Prepare notification content based on urgency
      const title = `Prazo Fiscal: ${deadline.name}`;
      const body = deadline.daysUntil === 0
        ? `O prazo para ${deadline.name} é HOJE!`
        : deadline.daysUntil === 1
          ? `O prazo para ${deadline.name} é amanhã!`
          : `Faltam ${deadline.daysUntil} dias para o prazo de ${deadline.name} (${deadline.dueDate})`;

      // Store notifications
      const notifications = newUsersToNotify.map(user => ({
        user_id: user.user_id,
        notification_type: 'deadline',
        title,
        body,
        reference_id: referenceId,
      }));

      const { error: insertError } = await supabase
        .from('sent_notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Error storing notifications:', insertError);
      } else {
        totalSent += notifications.length;
        console.log(`Stored ${notifications.length} notifications for ${deadline.name}`);
      }
    }

    console.log(`=== Total notifications sent: ${totalSent} ===`);

    return new Response(
      JSON.stringify({
        success: true,
        notificationsSent: totalSent,
        deadlinesChecked: deadlines.length,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Check deadlines error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
