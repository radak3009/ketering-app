import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PickupRequest {
  card_id: string;
  order_item_id?: string; // Optional: if we know which specific order item
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { card_id, order_item_id } = await req.json() as PickupRequest;

    console.log('NFC Pickup request received:', { card_id, order_item_id });

    if (!card_id) {
      return new Response(
        JSON.stringify({ error: 'card_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find user by card_id
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('user_id, full_name')
      .eq('company_card_id', card_id)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found for card_id:', card_id, profileError);
      return new Response(
        JSON.stringify({ error: 'Kartica nije pronađena u sistemu' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile found:', profile);

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Find today's order items for this user that haven't been picked up yet
    let query = supabaseClient
      .from('order_items')
      .select(`
        id,
        pickup_status,
        shift,
        meal_id,
        meals (name, description),
        orders!inner (
          user_id,
          delivery_date
        )
      `)
      .eq('orders.user_id', profile.user_id)
      .eq('orders.delivery_date', today)
      .eq('pickup_status', 'nije_preuzeto');

    // If specific order_item_id is provided, filter by it
    if (order_item_id) {
      query = query.eq('id', order_item_id);
    }

    const { data: orderItems, error: orderError } = await query;

    if (orderError) {
      console.error('Error fetching order items:', orderError);
      return new Response(
        JSON.stringify({ error: 'Greška pri preuzimanju podataka o porudžbinama' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!orderItems || orderItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Nema obroka za preuzimanje danas',
          user_name: profile.full_name
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark all found order items as picked up
    const itemIds = orderItems.map(item => item.id);
    const { error: updateError } = await supabaseClient
      .from('order_items')
      .update({ 
        pickup_status: 'preuzeto',
        pickup_time: new Date().toISOString()
      })
      .in('id', itemIds);

    if (updateError) {
      console.error('Error updating pickup status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Greška pri ažuriranju statusa preuzimanja' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully marked as picked up:', itemIds);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Obrok uspešno preuzet!`,
        user_name: profile.full_name,
        items_count: orderItems.length,
        meals: orderItems.map(item => ({
          name: item.meals?.name,
          shift: item.shift
        }))
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in nfc-meal-pickup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
