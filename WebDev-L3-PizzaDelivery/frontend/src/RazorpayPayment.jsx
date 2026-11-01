import { useEffect, useRef, useState } from "react";

let checkoutPromise;

function loadCheckout() {
  if (typeof window.Razorpay === "function") {
    return Promise.resolve();
  }

  if (checkoutPromise) return checkoutPromise;

  checkoutPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;

    function cleanup() {
      window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
    }

    function failed() {
      cleanup();
      script.remove();

      reject(
        new Error(
          "Unable to load Razorpay. Check your connection and try again."
        )
      );
    }

    const timer = window.setTimeout(failed, 20000);

    script.onerror = failed;

    script.onload = () => {
      if (typeof window.Razorpay !== "function") {
        return failed();
      }

      cleanup();
      resolve();
    };

    document.body.appendChild(script);
  }).catch((error) => {
    checkoutPromise = null;
    throw error;
  });

  return checkoutPromise;
}

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export default function RazorpayPayment({
  order,
  accessToken,
  onLogout,
  onConfirmed,
}) {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const [started, setStarted] = useState(
    Boolean(order.razorpayOrderId) ||
      order.paymentStatus === "paid"
  );

  const mounted = useRef(false);
  const phase = useRef("idle");
  const checkoutRef = useRef(null);
  const paidRef = useRef(order.paymentStatus === "paid");
  const requests = useRef(new Set());

  useEffect(() => {
    mounted.current = true;
    phase.current = "idle";

    const controllers = requests.current;

    return () => {
      mounted.current = false;
      phase.current = "closed";

      for (const controller of controllers) {
        controller.abort();
      }

      controllers.clear();

      const checkout = checkoutRef.current;
      checkoutRef.current = null;
      checkout?.close();
    };
  }, []);

  function feedback(nextStatus, text, nextPhase = "idle") {
    if (!mounted.current) return;

    phase.current = nextPhase;
    setStatus(nextStatus);
    setMessage(text);
  }

  async function post(path, body) {
    const controller = new AbortController();
    requests.current.add(controller);

    const timer = window.setTimeout(
      () => controller.abort(),
      25000
    );

    try {
      const response = await fetch(
        `http://localhost:5000/api/payments/${path}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
          cache: "no-store",
          signal: controller.signal,
        }
      );

      if (response.status === 401 || response.status === 403) {
        const error = new Error(
          "Your session has expired or access was denied. Please log in again."
        );

        error.auth = true;
        throw error;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to process the payment request."
        );
      }

      return data;
    } finally {
      window.clearTimeout(timer);
      requests.current.delete(controller);
    }
  }

  function showError(error, uncertain = false) {
    const text =
      error.name === "AbortError" || error instanceof TypeError
        ? "Unable to confirm the result. Check payment status before paying again."
        : error.message || "Unable to confirm the payment.";

    if (error.auth) {
      feedback("blocked", text, "blocked");
    } else {
      feedback(
        uncertain ? "unconfirmed" : "error",
        text,
        uncertain ? "uncertain" : "idle"
      );
    }
  }

  function acceptResult(data) {
    if (data.verified === false) {
      if (data.canRetry === true) {
        feedback(
          "idle",
          data.message ||
            "No completed payment found. You can try again."
        );
      } else {
        feedback(
          "pending",
          data.message || "Payment is awaiting confirmation.",
          "uncertain"
        );
      }

      return;
    }

    const updated = data.order;

    const allowedStatuses = [
      "order_received",
      "in_kitchen",
      "sent_to_delivery",
      "payment_review",
    ];

    if (
      data.verified !== true ||
      !updated ||
      updated.id !== order.id ||
      updated.currency !== "EUR" ||
      updated.totalMinor !== order.totalMinor ||
      updated.paymentStatus !== "paid" ||
      typeof updated.stockDeducted !== "boolean" ||
      !allowedStatuses.includes(updated.status) ||
      !Array.isArray(updated.items)
    ) {
      throw new Error(
        "Unexpected payment confirmation. Check payment status again."
      );
    }

    if (!mounted.current) return;

    paidRef.current = true;
    setConfirmedOrder(updated);

    const review =
      updated.status === "payment_review" ||
      !updated.stockDeducted;

    feedback(
      review ? "review" : "success",
      data.message ||
        (review
          ? "Payment received. Contact the administrator."
          : "Payment verified and order confirmed.")
    );

    onConfirmed?.(updated);
  }

  async function verifyPayment(result) {
    if (
      !mounted.current ||
      phase.current !== "checkout"
    ) {
      return;
    }

    feedback(
      "verifying",
      "Verifying your test payment...",
      "verifying"
    );

    try {
      const data = await post("verify", {
        orderId: order.id,
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      });

      if (mounted.current) {
        acceptResult(data);
      }
    } catch (error) {
      showError(error, true);
    }
  }

  async function pay() {
    if (
      phase.current !== "idle" ||
      paidRef.current ||
      order.paymentStatus === "paid"
    ) {
      return;
    }

    feedback(
      "starting",
      "Preparing Razorpay checkout...",
      "starting"
    );

    try {
      await loadCheckout();

      if (!mounted.current) return;

      setStarted(true);

      const data = await post("create", {
        orderId: order.id,
      });

      if (!mounted.current) return;

      if (
        typeof data.keyId !== "string" ||
        !data.keyId.startsWith("rzp_test_") ||
        typeof data.razorpayOrderId !== "string" ||
        !/^order_[a-zA-Z0-9]+$/.test(data.razorpayOrderId) ||
        data.orderId !== order.id ||
        data.currency !== "EUR" ||
        !Number.isSafeInteger(data.amount) ||
        data.amount <= 0 ||
        data.amount !== order.totalMinor
      ) {
        throw new Error(
          "Invalid checkout details. Check payment status."
        );
      }

      const checkout = new window.Razorpay({
        key: data.keyId,
        order_id: data.razorpayOrderId,
        amount: data.amount,
        currency: data.currency,
        name: "Pizza Delivery",
        description: `Test payment for order ${order.id
          .slice(-8)
          .toUpperCase()}`,
        theme: {
          color: "#b7472a",
        },
        retry: {
          enabled: false,
        },
        handler: verifyPayment,
        modal: {
          confirm_close: true,
          ondismiss: () => {
            if (
              !mounted.current ||
              phase.current !== "checkout"
            ) {
              return;
            }

            checkoutRef.current = null;

            feedback(
              "cancelled",
              "Checkout closed. If you completed a payment, use Check payment status."
            );
          },
        },
      });

      checkoutRef.current = checkout;

      checkout.on("payment.failed", (response) => {
  if (
    !mounted.current ||
    phase.current !== "checkout"
  ) {
    return;
  }

  phase.current = "closing";
  checkout.close();
  checkoutRef.current = null;

  const paymentError = response?.error || {};

  const details = [
    typeof paymentError.description === "string"
      ? paymentError.description
      : "",
    typeof paymentError.reason === "string"
      ? `Reason: ${paymentError.reason}`
      : "",
    typeof paymentError.code === "string"
      ? `Code: ${paymentError.code}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");

  feedback(
    "error",
    details ||
      "The test payment was unsuccessful. Check its status before trying again."
  );
});

      feedback(
        "checkout",
        "Complete the test payment in the Razorpay window.",
        "checkout"
      );

      checkout.open();
    } catch (error) {
      showError(error);
    }
  }

  async function checkStatus() {
    if (!["idle", "uncertain"].includes(phase.current)) {
      return;
    }

    feedback(
      "checking",
      "Checking payment status...",
      "checking"
    );

    try {
      const data = await post("check", {
        orderId: order.id,
      });

      if (mounted.current) {
        acceptResult(data);
      }
    } catch (error) {
      showError(error, true);
    }
  }

  const currentOrder = confirmedOrder || order;
  const paid = currentOrder.paymentStatus === "paid";
  const review = currentOrder.status === "payment_review";

  const busy = [
    "starting",
    "checkout",
    "verifying",
    "checking",
  ].includes(status);

  const uncertain = [
    "pending",
    "unconfirmed",
  ].includes(status);

  const alert = [
    "error",
    "unconfirmed",
    "blocked",
    "review",
  ].includes(status);

  return (
    <section className="payment-section">
      <h3>Payment</h3>

      <p>Razorpay Test Mode — no real money is charged.</p>

      {paid && !review && !message && (
        <p role="status">
          Payment verified. Follow your order in My orders.
        </p>
      )}

      {review && !message && (
        <p role="alert">
          Payment received, but ingredients are unavailable.
          Contact the administrator; do not pay again.
        </p>
      )}

      {message && (
        <p role={alert ? "alert" : "status"}>
          {message}
        </p>
      )}

      {status === "blocked" ? (
        <button type="button" onClick={onLogout}>
          Back to login
        </button>
      ) : (!paid || review) && (
        <div className="builder-actions">
          {!paid && (
            <button
              type="button"
              onClick={pay}
              disabled={busy || uncertain}
            >
              {status === "starting"
                ? "Preparing..."
                : `Pay ${euroFormatter.format(
                    order.totalMinor / 100
                  )} with Razorpay`}
            </button>
          )}

          {started && (
            <button
              type="button"
              onClick={checkStatus}
              disabled={busy}
            >
              {status === "checking"
                ? "Checking..."
                : "Check payment status"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}