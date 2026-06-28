import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mock-payment, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200,
    })
  }

  const signature = req.headers.get('stripe-signature')
  const isMock = req.headers.get('x-mock-payment') === 'true'

  try {
    const body = await req.text()
    let orderNumber: string | undefined

    if (isMock) {
      const jsonBody = JSON.parse(body || '{}')
      orderNumber = jsonBody.order_number
      console.log(`[Webhook] Handling simulated payment for order number: ${orderNumber}`)
    } else {
      if (!signature) {
        throw new Error('Missing stripe-signature header')
      }
      // Cryptographically verify the Stripe webhook signature using webhookSecret
      const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

      // Handle the payment success event
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        orderNumber = paymentIntent.metadata.order_number
      }
    }

    if (orderNumber) {
      // Initialize Supabase Client with Service Role Key to bypass RLS for updating payment status
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Update the order's status to PAID and payment_status to completed
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'PAID', payment_status: 'completed' })
        .eq('order_number', orderNumber)
        .select()

      if (error) {
        throw error
      }

      if (data && data.length > 0) {
        const order = data[0]
        const billingAddress = typeof order.billing_address === 'string' ? JSON.parse(order.billing_address) : order.billing_address
        const email = billingAddress?.email || order.billing_address?.full_name || 'customer'
        console.log(`[Webhook] Order ${orderNumber} successfully marked as PAID via webhook`)
        console.log(`[Webhook] Email Dispatch: Dispatching order confirmation email to: ${email}`)
      } else {
        console.log(`[Webhook] No order found with order_number: ${orderNumber}`)
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`Webhook verification failed: ${errorMsg}`)
    return new Response(JSON.stringify({ error: `Webhook error: ${errorMsg}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
