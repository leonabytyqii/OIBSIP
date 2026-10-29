import { useEffect, useRef, useState } from "react";

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function formatPrice(amount) {
  return euroFormatter.format(amount / 100);
}

export default function OrderSummary({
  accessToken,
  selection,
  onEdit,
  onLogout,
}) {
  const [quote, setQuote] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);

  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [savedOrder, setSavedOrder] = useState(null);

  const saving = useRef(false);
  const pendingRequest = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadQuote() {
      try {
        const response = await fetch(
          "http://localhost:5000/api/orders/quote",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(selection),
            signal: controller.signal,
            cache: "no-store",
          }
        );

        if (controller.signal.aborted) return;

        if (response.status === 401 || response.status === 403) {
          setStatus("expired");
          return;
        }

        const data = await response.json();

        if (controller.signal.aborted) return;

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to calculate the total."
          );
        }

        const validQuote =
          data.currency === "EUR" &&
          Number.isSafeInteger(data.totalMinor) &&
          data.totalMinor >= 0 &&
          Array.isArray(data.items) &&
          data.items.length >= 3 &&
          data.items.every(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              Number.isSafeInteger(item.priceMinor) &&
              item.priceMinor >= 0
          );

        if (!validQuote) {
          throw new Error("The server returned an invalid total.");
        }

        setQuote(data);
        setStatus("success");
        setMessage("");
      } catch (error) {
        if (controller.signal.aborted) return;

        setStatus("error");
        setMessage(
          error instanceof TypeError
            ? "Unable to connect. Please try again."
            : error.message || "Unable to calculate the total."
        );
      }
    }

    loadQuote();

    return () => controller.abort();
  }, [accessToken, selection, retry]);

  function retryQuote() {
    setStatus("loading");
    setMessage("");
    setQuote(null);
    setRetry((value) => value + 1);
  }

  async function saveOrder() {
    if (
      saving.current ||
      savedOrder ||
      status !== "success" ||
      !quote ||
      saveStatus === "rejected"
    ) {
      return;
    }

    saving.current = true;
    setSaveStatus("saving");
    setSaveMessage("");

    try {
      // Keep the same ID and body when retrying a failed connection.
      if (!pendingRequest.current) {
        pendingRequest.current = {
          requestId: crypto.randomUUID(),
          base: selection.base,
          sauce: selection.sauce,
          cheese: selection.cheese,
          veggie: [...selection.veggie],
          expectedTotalMinor: quote.totalMinor,
        };
      }

      const response = await fetch(
        "http://localhost:5000/api/orders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(pendingRequest.current),
          cache: "no-store",
        }
      );

      if (response.status === 401 || response.status === 403) {
        setStatus("expired");
        setSaveStatus("idle");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400 || response.status === 409) {
          setSaveStatus("rejected");
          setSaveMessage(
            data.message || "Please review your selection again."
          );
          return;
        }

        if (response.status === 429) {
          setSaveStatus("uncertain");
          setSaveMessage(
            "Too many attempts. Wait before clicking Retry saving."
          );
          return;
        }

        throw new Error("Unable to confirm saving.");
      }

      const order = data.order;

      if (
        !order ||
        typeof order.id !== "string" ||
        order.currency !== "EUR" ||
        !Number.isSafeInteger(order.totalMinor) ||
        order.totalMinor < 0 ||
        typeof order.paymentStatus !== "string"
      ) {
        throw new Error("Invalid order response.");
      }

      setSavedOrder(order);
      setSaveStatus("success");
      setSaveMessage("");
    } catch {
      setSaveStatus("uncertain");
      setSaveMessage(
        "Unable to confirm saving. Keep this page open and click Retry saving to check the same request."
      );
    } finally {
      saving.current = false;
    }
  }

  if (savedOrder) {
    return (
      <section className="pizza-builder">
        <h2>Order saved</h2>

        <p role="status">
          Order #{savedOrder.id.slice(-8).toUpperCase()}
        </p>

        <p>
          Total: <strong>{formatPrice(savedOrder.totalMinor)}</strong>
        </p>

        {savedOrder.paymentStatus === "pending" && (
          <p>
            Awaiting payment. No payment has been taken.
            Payment integration is not available yet.
          </p>
        )}

        <p>
          You can see this order in My orders.
          The list updates automatically every 10 seconds.
        </p>
      </section>
    );
  }

  const lockEditing =
    saveStatus === "saving" || saveStatus === "uncertain";

  return (
    <section className="pizza-builder">
      <h2>Order summary</h2>

      {status === "loading" && (
        <p role="status">Calculating your total...</p>
      )}

      {status === "expired" && (
        <>
          <p role="alert">
            Your session has expired or access was denied.
            Please log in again.
          </p>

          <button type="button" onClick={onLogout}>
            Back to login
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <p role="alert">{message}</p>

          <button type="button" onClick={retryQuote}>
            Try again
          </button>
        </>
      )}

      {status === "success" && quote && (
        <>
          <ul className="order-summary-list">
            {quote.items.map((item) => (
              <li key={item.id}>
                <span>{item.name}</span>
                <span>{formatPrice(item.priceMinor)}</span>
              </li>
            ))}
          </ul>

          <p className="order-total">
            <strong>
              Total: {formatPrice(quote.totalMinor)}
            </strong>
          </p>

          <p>
            Save your order as awaiting payment.
            This does not make a payment or reserve stock.
          </p>

          {saveMessage && <p role="alert">{saveMessage}</p>}
        </>
      )}

      {status !== "expired" && (
        <div className="builder-actions">
          <button
            type="button"
            onClick={onEdit}
            disabled={lockEditing}
          >
            Edit selection
          </button>

          {status === "success" && quote && (
            <button
              type="button"
              onClick={saveOrder}
              disabled={
                saveStatus === "saving" ||
                saveStatus === "rejected"
              }
            >
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "uncertain"
                  ? "Retry saving"
                  : "Save order"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}