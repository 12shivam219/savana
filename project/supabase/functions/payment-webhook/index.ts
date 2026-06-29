import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

// Server-side secret used ONLY for non-production environments.
// Required to be set whenever the x-test-payment header is honoured.
// Production deploys must leave this unset.
const testPaymentSecret = Deno.env.get('PAYMENT_TEST_SECRET') || ''
const isProduction = (Deno.env.get('ENVIRONMENT') || 'production') === 'production'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-test-payment, x-test-signature, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Constant-time string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const signature = req.headers.get('stripe-signature') ?? ''
  const isTestPayment = req.headers.get('x-test-payment') === 'true'
  const testSigHeader = req.headers.get('x-test-signature') ?? ''

  try {
    const body = await req.text()
    let orderNumber: string | undefined
    let paymentIntentId: string | undefined

    // -----------------------------------------------------------------
    // Branch 1: Test payment (only allowed when PAYMENT_TEST_SECRET is
    // configured AND environment != production). Requires HMAC of the
    // order_number signed with the server-side secret. This means the
    // header x-test-signature cannot be forged without knowing the
    // secret, which is never exposed to the browser.
    // -----------------------------------------------------------------
    if (isTestPayment) {
      if (isProduction || !testPaymentSecret) {
        console.error('[Webhook] Test payment rejected — not enabled in this environment')
        return jsonResponse({ error: 'Test payments disabled' }, 403)
      }

      let parsed: { order_number?: string; payment_intent_id?: string }
      try {
        parsed = JSON.parse(body || '{}')
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400)
      }

      orderNumber = parsed.order_number?.toString().trim()
      paymentIntentId = parsed.payment_intent_id?.toString().trim()

      if (!orderNumber || !isValidUuid(orderNumber)) {
        return jsonResponse({ error: 'Invalid order_number' }, 400)
      }

      // Verify HMAC over `orderNumber` so callers without the secret
      // cannot forge payments.
      const expected = await hmacSha256Hex(testPaymentSecret, orderNumber)
      if (!timingSafeEqual(expected, testSigHeader.toLowerCase())) {
        console.error('[Webhook] Test payment signature mismatch')
        return jsonResponse({ error: 'Invalid test signature' }, 401)
      }
    } else {
      // -----------------------------------------------------------------
      // Branch 2: Production — require a valid Stripe signature.
      // -----------------------------------------------------------------
      if (!signature) {
        return jsonResponse({ error: 'Missing stripe-signature header' }, 400)
      }
      if (!webhookSecret) {
        console.error('[Webhook] STRIPE_WEBHOOK_SECRET is not configured')
        return jsonResponse({ error: 'Server misconfigured' }, 500)
      }

      const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        orderNumber = paymentIntent.metadata?.order_number
        paymentIntentId = paymentIntent.id
      } else if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session
        orderNumber = session.metadata?.order_number
        paymentIntentId = session.payment_intent as string | undefined
      } else {
        // Acknowledge but ignore unrelated events
        return jsonResponse({ received: true, ignored: event.type }, 200)
      }
    }

    if (!orderNumber || !isValidUuid(orderNumber)) {
      return jsonResponse({ error: 'order_number missing or invalid' }, 400)
    }

    // -----------------------------------------------------------------
    // Mark order as PAID — only if it is in a state where payment is
    // pending. This prevents re-processing a delivered order's payment
    // event and limits the blast radius of any bug in upstream code.
    // -----------------------------------------------------------------
    const { data: updated, error: updateErr } = await supabase
      .from('orders')
      .update({
        status: 'PAID',
        payment_status: 'completed',
        payment_id: paymentIntentId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('order_number', orderNumber)
      .in('status', ['PENDING_PAYMENT', 'pending'])
      .select('id, billing_address, user_id')
      .maybeSingle()

    if (updateErr) {
      console.error('[Webhook] Failed to update order:', updateErr)
      return jsonResponse({ error: 'Failed to update order' }, 500)
    }

    if (!updated) {
      // Either no such order or order was already past payment state.
      // Returning 200 prevents Stripe from retrying indefinitely.
      console.log(`[Webhook] No eligible order for order_number: ${orderNumber}`)
      return jsonResponse({ received: true, matched: false }, 200)
    }

    console.log(`[Webhook] Order ${orderNumber} marked as PAID via ${isTestPayment ? 'TEST' : 'Stripe'} payment`)

    // TODO: enqueue order confirmation email here
    // const email = updated.billing_address?.email ?? 'unknown'
    // console.log(`[Webhook] Email Dispatch: sending confirmation to ${email}`)

    return jsonResponse({ received: true, matched: true }, 200)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Webhook] Verification failed: ${errorMsg}`)
    return jsonResponse({ error: `Webhook error: ${errorMsg}` }, 400)
  }
})