import { t } from "@/lib/i18n";
// Premium in the browser. The server decides entitlements; this only shows them and runs Razorpay Checkout.
export type PlanKey = "premium_monthly" | "premium_annual";
export type Plans = {
  billing_enabled: boolean; currency: string; trial_days?: number; premium_features?: string[]; always_free?: string[]; note?: string;
  plans: Record<string, { name: string; label?: string; amount_paise?: number; period?: string }>;
};
export type BillingStatus = {
  billing_enabled: boolean; premium: boolean; plan: string; status: string; ai_daily_limit: number; priority_booking: boolean; premium_accessories: string[];
  trial_ends_at: string | null; current_period_end: string | null; cancelled_at: string | null; trial_available: boolean; checkout_configured: boolean;
};
type Checkout = { subscription_id: string; key_id: string; trial_days: number; name: string; description: string; prefill: { email: string } };
type RazorpayResponse = { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void };
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance } }

export async function billingRequest<T>(action: string, body?: unknown): Promise<T> {
  const response = await fetch("/api/billing/" + action, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || t("Premium is unavailable right now. You haven't been charged."));
  return data as T;
}

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
/** Razorpay's checkout script is loaded only when someone taps Subscribe, never on page load. */
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script"); script.src = CHECKOUT_SCRIPT; script.async = true;
    script.onload = () => resolve(); script.onerror = () => reject(new Error(t("Couldn't reach Razorpay. Check your connection; you haven't been charged.")));
    document.head.appendChild(script);
  });
}

/** Opens Razorpay Checkout for the plan. Resolves with the new status after the server verifies the payment
 *  signature, or null if the person closed the window. */
export async function subscribe(plan: PlanKey): Promise<BillingStatus | null> {
  const session = await billingRequest<Checkout>("checkout", { plan });
  await loadCheckout();
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: session.key_id, subscription_id: session.subscription_id, name: session.name, description: session.description,
      prefill: session.prefill, theme: { color: "#214c38" },
      handler: (response: RazorpayResponse) => { billingRequest<BillingStatus>("verify", response).then(resolve, reject); },
      modal: { ondismiss: () => resolve(null) },
    });
    checkout.on("payment.failed", event => reject(new Error(event.error?.description || t("The payment didn't go through. You haven't been charged."))));
    checkout.open();
  });
}

export const rupees = (paise = 0) => "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
export const dateText = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "";
