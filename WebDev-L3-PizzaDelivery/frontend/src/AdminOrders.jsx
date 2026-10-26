import { useEffect, useRef, useState } from "react";

const statusLabels = {
  order_received: "Order received",
  in_kitchen: "In kitchen",
  sent_to_delivery: "Sent to delivery",
};

const nextStatuses = {
  order_received: "in_kitchen",
  in_kitchen: "sent_to_delivery",
};

const buttonLabels = {
  order_received: "Move to kitchen",
  in_kitchen: "Send to delivery",
};

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function validOrder(order) {
  return (
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
}

export default function AdminOrders({ accessToken, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [savingId, setSavingId] = useState(null);
  const saving = useRef(false);

  function handleAuthError(code) {
    setOrders([]);
    setStatus("blocked");
    setMessage(
      code === 401
        ? "Your session has expired. Please log in again."
        : "Access denied. Admin account required."
    );
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrders() {
      setStatus("loading");
      setMessage("");
      setOrders([]);

      try {
        const response = await fetch(
          "http://localhost:5000/api/admin/orders",
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
          handleAuthError(response.status);
          return;
        }

        const data = await response.json();

        if (controller.signal.aborted) return;

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load orders."
          );
        }

        if (
          !Array.isArray(data.orders) ||
          !data.orders.every(validOrder)
        ) {
          throw new Error("Invalid order list received.");
        }

        setOrders(data.orders);
        setStatus("success");
      } catch (error) {
        if (controller.signal.aborted) return;

        setStatus("error");
        setMessage(
          error instanceof TypeError
            ? "Unable to connect. Please try again."
            : error.message || "Unable to load orders."
        );
      }
    }

    loadOrders();

    return () => controller.abort();
  }, [accessToken, retry]);

  async function advanceOrder(order) {
    const nextStatus = nextStatuses[order.status];

    if (
      saving.current ||
      status !== "success" ||
      !nextStatus
    ) {
      return;
    }

    saving.current = true;
    setSavingId(order.id);
    setMessage("");

    try {
      const response = await fetch(
        `http://localhost:5000/api/admin/orders/${order.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            expectedStatus: order.status,
            status: nextStatus,
          }),
        }
      );

      if (response.status === 401 || response.status === 403) {
        handleAuthError(response.status);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to update the order."
        );
      }

      if (
        !validOrder(data.order) ||
        data.order.id !== order.id ||
        data.order.status !== nextStatus
      ) {
        throw new Error("Unexpected response from the server.");
      }

      setOrders((current) =>
        current.map((item) =>
          item.id === data.order.id ? data.order : item
        )
      );

      setMessage("Order status updated successfully.");
    } catch (error) {
      setStatus("error");
      setMessage(
        `${error.message || "Unable to confirm the update."} Refresh orders before trying again.`
      );
    } finally {
      saving.current = false;
      setSavingId(null);
    }
  }

  function refreshOrders() {
    if (saving.current || status === "loading") return;

    setStatus("loading");
    setRetry((value) => value + 1);
  }

  return (
    <section className="my-orders">
      <h2>Manage orders</h2>
      <p>Latest 100 paid orders ready for preparation or delivery.</p>

      {status === "loading" && (
        <p role="status">Loading orders...</p>
      )}

      {message && (
        <p role={status === "success" ? "status" : "alert"}>
          {message}
        </p>
      )}

      {status === "blocked" ? (
        <button type="button" onClick={onLogout}>
          Back to login
        </button>
      ) : (
        <button
          type="button"
          onClick={refreshOrders}
          disabled={status === "loading" || savingId !== null}
        >
          Refresh orders
        </button>
      )}

      {status === "success" && orders.length === 0 && (
        <p>No paid orders yet.</p>
      )}

      <div className="orders-list">
        {orders.map((order) => (
          <article className="order-card" key={order.id}>
            <h3>Order #{order.id.slice(-8).toUpperCase()}</h3>

            <p>
              Customer: {order.customer?.name || "Unavailable"}
            </p>

            {order.customer?.email && (
              <p>Email: {order.customer.email}</p>
            )}

            <p>
              Date: {new Date(order.createdAt).toLocaleString()}
            </p>

            <p>
              Ingredients:{" "}
              {order.items.map((item) => item.name).join(", ")}
            </p>

            <p>
              Total: {euroFormatter.format(order.totalMinor / 100)}
            </p>

            <p>
              Status:{" "}
              <strong>
                {statusLabels[order.status] || "Unknown"}
              </strong>
            </p>

            {nextStatuses[order.status] && (
              <button
                type="button"
                onClick={() => advanceOrder(order)}
                disabled={
                  savingId !== null || status !== "success"
                }
              >
                {savingId === order.id
                  ? "Updating..."
                  : buttonLabels[order.status]}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}