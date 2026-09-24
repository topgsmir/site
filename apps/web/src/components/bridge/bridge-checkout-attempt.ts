export type BridgeCheckoutInput = {
  offerId: string;
  quantity: number;
  trafficSource: string;
  bridgeFields: Array<{ key: string; value: string }>;
};

type PaymentResult = { paymentUrl: string };
type CheckoutRequests = {
  createOrder: (input: BridgeCheckoutInput, key: string) => Promise<{ id: string }>;
  initiatePayment: (orderId: string, key: string) => Promise<PaymentResult>;
};

/** One immutable purchase intent. Keep it across failures, including lost responses.
 * Sensitive inputs live only in component memory; the API owns durable deduplication.
 */
export function createBridgeCheckoutAttempt(
  input: BridgeCheckoutInput,
  requests: CheckoutRequests,
  newKey: () => string = () => crypto.randomUUID(),
) {
  const snapshot = { ...input, bridgeFields: input.bridgeFields.map((field) => ({ ...field })) };
  const orderKey = newKey();
  const paymentKey = newKey();
  let orderId: string | undefined;
  let pending: Promise<PaymentResult> | undefined;

  async function run() {
    if (!orderId) {
      const order = await requests.createOrder(snapshot, orderKey);
      orderId = order.id;
    }
    return requests.initiatePayment(orderId, paymentKey);
  }

  return {
    get orderId() { return orderId; },
    pay(): Promise<PaymentResult> {
      if (!pending) {
        pending = run().finally(() => { pending = undefined; });
      }
      return pending;
    },
  };
}
