import { useEffect, useRef, useState } from "react";
import AdminOrders from "./AdminOrders";

function InventoryRow({ item, accessToken, onSaved, onAuthError }) {
  const [stock, setStock] = useState(String(item.stock));
  const [threshold, setThreshold] = useState(
    String(item.lowStockThreshold)
  );
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const saving = useRef(false);

  const locked = status === "saving" || status === "conflict";

  async function saveValue(event, field) {
    event.preventDefault();
    if (saving.current || status === "conflict") return;

    const isStock = field === "stock";
    const value = (isStock ? stock : threshold).trim();
    const number = Number(value);

    if (
      !/^\d+$/.test(value) ||
      !Number.isSafeInteger(number) ||
      number < 0 ||
      number > 1000000
    ) {
      setStatus("error");
      setMessage("Enter a whole number from 0 to 1000000.");
      return;
    }

    const body = isStock
      ? {
          stock: number,
          expectedStock: item.stock,
        }
      : {
          lowStockThreshold: number,
          expectedThreshold: item.lowStockThreshold,
        };

    saving.current = true;
    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch(
        `http://localhost:5000/api/admin/ingredients/${item.id}/${field}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (response.status === 401 || response.status === 403) {
        onAuthError(response.status);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setStatus(
          response.status === 400 ? "error" : "conflict"
        );
        setMessage(
          response.status === 400
            ? data.message || "Please check the entered value."
            : `${data.message || "Unable to save."} Use Reload inventory.`
        );
        return;
      }

      const updated = data.ingredient;

      if (
        !updated ||
        updated.id !== item.id ||
        !Number.isSafeInteger(updated.stock) ||
        !Number.isSafeInteger(updated.lowStockThreshold)
      ) {
        throw new Error("Invalid inventory response.");
      }

      onSaved(updated);

      if (isStock) {
        setStock(String(updated.stock));
      } else {
        setThreshold(String(updated.lowStockThreshold));
      }

      setStatus("success");
      setMessage(
        isStock ? "Stock saved." : "Alert threshold saved."
      );
    } catch {
      setStatus("conflict");
      setMessage(
        "Unable to confirm saving. Reload inventory to check."
      );
    } finally {
      saving.current = false;
    }
  }

  function clearMessage() {
    setStatus("idle");
    setMessage("");
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

      <td>
        <form
          className="stock-form"
          onSubmit={(event) => saveValue(event, "threshold")}
        >
          <input
            type="number"
            aria-label={`Alert threshold for ${item.name}`}
            min="0"
            max="1000000"
            step="1"
            required
            value={threshold}
            disabled={locked}
            onChange={(event) => {
              setThreshold(event.target.value);
              clearMessage();
            }}
          />

          <button
            type="submit"
            disabled={
              locked ||
              threshold.trim() === "" ||
              Number(threshold) === item.lowStockThreshold
            }
          >
            Save
          </button>
        </form>
      </td>

      <td>
        {item.stock === 0
          ? "Out of stock"
          : item.lowStock
            ? "Low stock"
            : "In stock"}
      </td>

      <td>{item.isActive ? "Yes" : "No"}</td>

      <td>
        <form
          className="stock-form"
          onSubmit={(event) => saveValue(event, "stock")}
        >
          <input
            type="number"
            aria-label={`New stock for ${item.name}`}
            min="0"
            max="1000000"
            step="1"
            required
            value={stock}
            disabled={locked}
            onChange={(event) => {
              setStock(event.target.value);
              clearMessage();
            }}
          />

          <button
            type="submit"
            disabled={
              locked ||
              stock.trim() === "" ||
              Number(stock) === item.stock
            }
          >
            Save
          </button>
        </form>

        {status === "saving" && (
          <p className="stock-message" role="status">
            Saving...
          </p>
        )}

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