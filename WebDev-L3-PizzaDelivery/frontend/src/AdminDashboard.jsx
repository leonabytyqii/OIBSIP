import { useEffect, useRef, useState } from "react";
import AdminOrders from "./AdminOrders";

function InventoryRow({ item, accessToken, onSaved, onAuthError }) {
  const [stock, setStock] = useState(String(item.stock));
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const saving = useRef(false);

  async function saveStock(event) {
    event.preventDefault();
    if (saving.current) return;

    const value = stock.trim();
    const newStock = Number(value);

    if (
      !/^\d+$/.test(value) ||
      !Number.isSafeInteger(newStock) ||
      newStock < 0 ||
      newStock > 1000000
    ) {
      setStatus("error");
      setMessage("Enter a whole number from 0 to 1000000.");
      return;
    }

    saving.current = true;
    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch(
        `http://localhost:5000/api/admin/ingredients/${item.id}/stock`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            stock: newStock,
            expectedStock: item.stock,
          }),
        }
      );

      if (response.status === 401 || response.status === 403) {
        onAuthError(response.status);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 || response.status === 404) {
          setStatus("conflict");
          setMessage(data.message + " Use Reload inventory.");
          return;
        }

        throw new Error(data.message || "Unable to save stock.");
      }

      if (!data.ingredient || data.ingredient.id !== item.id) {
        throw new Error("Unexpected response. Reload inventory.");
      }

      onSaved(data.ingredient);
      setStock(String(data.ingredient.stock));
      setStatus("success");
      setMessage("Saved.");
    } catch {
      setStatus("error");
      setMessage("Unable to confirm saving. Reload inventory to check.");
    } finally {
      saving.current = false;
    }
  }

  const price = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(item.priceMinor / 100);

  return (
    <tr>
      <td>{item.name}</td>
      <td>{item.category}</td>
      <td>{price}</td>
      <td>{item.stock}</td>
      <td>{item.lowStockThreshold}</td>
      <td>
        {item.stock === 0
          ? "Out of stock"
          : item.lowStock
            ? "Low stock"
            : "In stock"}
      </td>
      <td>{item.isActive ? "Yes" : "No"}</td>
      <td>
        <form className="stock-form" onSubmit={saveStock}>
          <input
            type="number"
            aria-label={`New stock for ${item.name}`}
            min="0"
            max="1000000"
            step="1"
            required
            value={stock}
            disabled={status === "saving" || status === "conflict"}
            onChange={(event) => {
              setStock(event.target.value);
              setStatus("idle");
              setMessage("");
            }}
          />

          <button
            type="submit"
            disabled={
              status === "saving" ||
              status === "conflict" ||
              stock.trim() === "" ||
              Number(stock) === item.stock
            }
          >
            {status === "saving" ? "Saving..." : "Save"}
          </button>
        </form>

        {message && (
          <p
            className="stock-message"
            role={status === "success" ? "status" : "alert"}
          >
            {message}
          </p>
        )}
      </td>
    </tr>
  );
}

export default function AdminDashboard({
  user,
  accessToken,
  onLogout,
}) {
  const [ingredients, setIngredients] = useState([]);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);

  function handleAuthError(code) {
    setIngredients([]);
    setStatus("blocked");
    setMessage(
      code === 401
        ? "Your session has expired. Please log in again."
        : "Access denied. Admin account required."
    );
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadInventory() {
      setStatus("loading");
      setMessage("");
      setIngredients([]);

      try {
        const response = await fetch(
          "http://localhost:5000/api/admin/ingredients",
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

        if (!response.ok) {
          throw new Error(data.message || "Unable to load inventory.");
        }

        if (!Array.isArray(data.ingredients)) {
          throw new Error("Invalid inventory response.");
        }

        if (controller.signal.aborted) return;

        setIngredients(data.ingredients);
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

    loadInventory();

    return () => controller.abort();
  }, [accessToken, retry]);

  function updateIngredient(updated) {
    setIngredients((current) =>
      current.map((item) => (item.id === updated.id ? updated : item))
    );
  }

  function reloadInventory() {
    setStatus("loading");
    setIngredients([]);
    setRetry((value) => value + 1);
  }

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <div>
          <h2>Admin dashboard</h2>
          <p>Welcome, {user.name}!</p>
        </div>

        <button type="button" onClick={onLogout}>
          Log out
        </button>
      </div>

      <h3>Ingredient inventory</h3>

      {status === "loading" && (
        <p role="status">Loading inventory...</p>
      )}

      {message && <p role="alert">{message}</p>}

      {status === "blocked" && (
        <button type="button" onClick={onLogout}>
          Back to login
        </button>
      )}

      {(status === "success" || status === "error") && (
        <button type="button" onClick={reloadInventory}>
          Reload inventory
        </button>
      )}

      {status === "success" && (
        <>
          <p>
            Total ingredients: {ingredients.length} | Low stock:{" "}
            {ingredients.filter((item) => item.lowStock).length}
          </p>

          <p>
            Enter the new total quantity and click Save.
            Reload inventory discards unsaved edits.
          </p>

          {ingredients.length === 0 ? (
            <p>No ingredients found.</p>
          ) : (
            <div className="inventory-table-wrapper">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th scope="col">Ingredient</th>
                    <th scope="col">Category</th>
                    <th scope="col">Price</th>
                    <th scope="col">Stock</th>
                    <th scope="col">Alert threshold</th>
                    <th scope="col">Stock status</th>
                    <th scope="col">Available in menu</th>
                    <th scope="col">Update stock</th>
                  </tr>
                </thead>

                <tbody>
                  {ingredients.map((item) => (
                    <InventoryRow
                      key={item.id}
                      item={item}
                      accessToken={accessToken}
                      onSaved={updateIngredient}
                      onAuthError={handleAuthError}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
         </>
      )}

      {status !== "blocked" && (
        <AdminOrders
          accessToken={accessToken}
          onLogout={onLogout}
        />
      )}
    </section>
  );
}