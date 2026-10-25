import { useEffect, useState } from "react";

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

  useEffect(() => {
    const controller = new AbortController();

    async function loadQuote() {
      setStatus("loading");
      setMessage("");
      setQuote(null);

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

        if (response.status === 401) {
          setStatus("expired");
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to calculate the total.");
        }

        if (
          data.currency !== "EUR" ||
          !Array.isArray(data.items) ||
          !Number.isSafeInteger(data.totalMinor) ||
          data.totalMinor < 0
        ) {
          throw new Error("The server returned an invalid total.");
        }

        if (controller.signal.aborted) return;

        setQuote(data);
        setStatus("success");
      } catch (error) {
        if (controller.signal.aborted) return;

        setStatus("error");
        setMessage(
          error instanceof TypeError
            ? "Unable to connect. Please try again."
            : error.message
        );
      }
    }

    loadQuote();

    return () => controller.abort();
  }, [accessToken, selection, retry]);

  function formatPrice(amount) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount / 100);
}

  return (
    <section className="pizza-builder">
      <h2>Order summary</h2>

      {status === "loading" && (
        <p role="status">Calculating your total...</p>
      )}

      {status === "expired" && (
        <>
          <p role="alert">
            Your session has expired. Please log in again.
          </p>
          <button type="button" onClick={onLogout}>
            Back to login
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <p role="alert">{message}</p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
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
            <strong>Total: {formatPrice(quote.totalMinor)}</strong>
          </p>
        </>
      )}

      {status !== "expired" && (
        <div className="builder-actions">
          <button type="button" onClick={onEdit}>
            Edit selection
          </button>
        </div>
      )}
    </section>
  );
}