import { useEffect, useState } from "react";

const orderStatuses = {
  awaiting_payment: "Awaiting payment",
  order_received: "Order received",
  in_kitchen: "In kitchen",
  sent_to_delivery: "Sent to delivery",
};

const paymentStatuses = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
};

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export default function MyOrders({ accessToken, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer;

   
    async function loadOrders() {
      let shouldRefresh = true;

      try {
        const response = await fetch(
          "http://localhost:5000/api/orders/my",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (controller.signal.aborted) return;

        if (response.status === 401 || response.status === 403) {
          shouldRefresh = false;
          setOrders([]);
          setStatus("blocked");
          setMessage(
            response.status === 401
              ? "Your session has expired. Please log in again."
              : "You do not have access to these orders."
          );
          return;
        }

        const data = await response.json();

        if (controller.signal.aborted) return;

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load your orders."
          );
        }

        const validOrders =
          Array.isArray(data.orders) &&
          data.orders.every(
            (order) =>
              order &&
              typeof order.id === "string" &&
              order.currency === "EUR" &&
              Number.isSafeInteger(order.totalMinor) &&
              order.totalMinor >= 0 &&
              Array.isArray(order.items) &&
              order.items.every(
                (item) => item && typeof item.name === "string"
              )
          );

        if (!validOrders) {
          throw new Error("The server returned an invalid order list.");
        }

        setOrders(data.orders);
        setStatus("success");
        setMessage("");
      } catch (error) {
        if (controller.signal.aborted) return;

        setStatus("error");
        setMessage(
          error instanceof TypeError
            ? "Unable to connect. Retrying automatically..."
            : error.message || "Unable to load your orders."
        );
      } finally {
        if (!controller.signal.aborted && shouldRefresh) {
          timer = window.setTimeout(loadOrders, 10000);
        }
      }
    }

    loadOrders();

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [accessToken, retryCount]);

  return (
    <section className="my-orders">
      <h2>My orders</h2>
      <p>Your latest 50 orders. Updates automatically every 10 seconds.</p>

      {status === "loading" && (
        <p role="status">Loading your orders...</p>
      )}

      {message && <p role="alert">{message}</p>}

      {status === "blocked" ? (
        <button type="button" onClick={onLogout}>
          Back to login
        </button>
      ) : (
        <button
          type="button"
          disabled={status === "loading"}
          onClick={() => {
  setStatus("loading");
  setMessage("");
  setRetryCount((count) => count + 1);
}}
        >
          Refresh orders
        </button>
      )}

      {status === "success" && orders.length === 0 && (
        <p>You have no orders yet.</p>
      )}

      {status === "error" && orders.length > 0 && (
        <p>Showing the last loaded orders. Statuses may be outdated.</p>
      )}

      <div className="orders-list">
        {orders.map((order) => (
          <article className="order-card" key={order.id}>
            <h3>Order #{order.id.slice(-8).toUpperCase()}</h3>

            <p>
              Date: {new Date(order.createdAt).toLocaleString()}
            </p>

            <p>
              Status:{" "}
              <strong>
                {orderStatuses[order.status] || "Unknown"}
              </strong>
            </p>

            <p>
              Payment:{" "}
              {paymentStatuses[order.paymentStatus] || "Unknown"}
            </p>

            <p>
              Ingredients:{" "}
              {order.items.map((item) => item.name).join(", ")}
            </p>

            <p>
              <strong>
                Total: {euroFormatter.format(order.totalMinor / 100)}
              </strong>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}