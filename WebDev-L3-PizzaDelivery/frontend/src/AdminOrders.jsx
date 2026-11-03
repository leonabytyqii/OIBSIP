import { useEffect, useRef, useState } from "react";

const ordersUrl = "http://localhost:5000/api/admin/orders";

const statusLabels = {
  order_received: "Order received",
  in_kitchen: "In kitchen",
  sent_to_delivery: "Sent to delivery",
  payment_review: "Payment received — stock review required",
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
  const [view, setView] = useState("active");
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
      setOrders([]);

      try {
        const response = await fetch(
          `${ordersUrl}?view=${view}`,
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
  }, [accessToken, retry, view]);

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
        `${ordersUrl}/${order.id}/status`,
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

  async function changeArchiveState(order) {
    if (saving.current || status !== "success" || order.status !== "sent_to_delivery") {
      return;
    }

    const archived = view === "active";
    saving.current = true;
    setSavingId(order.id);
    setMessage("");

    try {
      const response = await fetch(`${ordersUrl}/${order.id}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ archived }),
      });

      if (response.status === 401 || response.status === 403) {
        handleAuthError(response.status);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update the archive.");
      }

      if (data.id !== order.id || data.archived !== archived) {
        throw new Error("Unexpected response from the server.");
      }

      setOrders((current) => current.filter((item) => item.id !== order.id));
      setStatus("loading");
      setRetry((value) => value + 1);
      setMessage(archived ? "Order archived." : "Order restored to Active orders.");
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Unable to update the archive. Refresh orders.");
    } finally {
      saving.current = false;
      setSavingId(null);
    }
  }

  function changeView(nextView) {
    if (saving.current || status === "loading" || view === nextView) return;

    setMessage("");
    setOrders([]);
    setStatus("loading");
    setView(nextView);
  }

  function refreshOrders() {
    if (saving.current || status === "loading") return;

    setMessage("");
    setStatus("loading");
    setRetry((value) => value + 1);
  }

  return (
    <section className="my-orders">
      <h2>Manage orders</h2>
      <p>
        {view === "active"
          ? "Latest 100 active paid orders, including orders awaiting stock review."
          : "Latest 100 archived orders."}
      </p>

      {status !== "blocked" && (
        <div className="builder-actions" role="group" aria-label="Order controls">
          {[
            ["active", "Active orders"],
            ["archived", "Archived orders"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              style={view === key ? undefined : { background: "transparent", color: "#a63516" }}
              onClick={() => changeView(key)}
              disabled={status === "loading" || savingId !== null}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={refreshOrders}
            disabled={status === "loading" || savingId !== null}
          >
            Refresh orders
          </button>
        </div>
      )}

      {status === "loading" && (
        <p role="status">Loading orders...</p>
      )}

      {message && (
        <p role={status === "success" || status === "loading" ? "status" : "alert"}>
          {message}
        </p>
      )}

      {status === "blocked" && (
        <button type="button" onClick={onLogout}>
          Back to login
        </button>
      )}

      {status === "success" && orders.length === 0 && (
        <p>{view === "archived" ? "No archived orders yet." : "No active paid orders."}</p>
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

            {view === "active" && nextStatuses[order.status] && (
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
            {order.status === "sent_to_delivery" && (
              <button
                type="button"
                onClick={() => changeArchiveState(order)}
                disabled={savingId !== null || status !== "success"}
              >
                {savingId === order.id
                  ? "Updating..."
                  : view === "archived" ? "Restore" : "Archive"}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
