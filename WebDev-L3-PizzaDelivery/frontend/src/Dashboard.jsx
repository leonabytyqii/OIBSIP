import { useEffect, useState } from "react";
import PizzaBuilder from "./PizzaBuilder";
export default function Dashboard({ user, accessToken, onLogout }) {
  const [pizzas, setPizzas] = useState([]);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPizzas() {
      setStatus("loading");
      setMessage("");

      try {
        const response = await fetch(
          "http://localhost:5000/api/pizzas",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (controller.signal.aborted) return;

        if (response.status === 401) {
          setPizzas([]);
          setStatus("expired");
          setMessage("Your session has expired. Please log in again.");
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load pizzas. Please try again."
          );
        }

        if (!Array.isArray(data.pizzas)) {
          throw new Error("The server returned an invalid pizza list.");
        }

        setPizzas(data.pizzas);
        setStatus("success");
      } catch (error) {
        if (controller.signal.aborted) return;

        setStatus("error");
        setMessage(
          error instanceof TypeError
            ? "Unable to connect to the server. Please try again."
            : error.message || "Unable to load pizzas."
        );
      }
    }

    loadPizzas();

    return () => controller.abort();
  }, [accessToken, retryCount]);

  return (
    <section className="dashboard">
      <header className="dashboard-header">
        <div>
          <h2>Welcome, {user.name}!</h2>
          <p>Explore our pizza menu.</p>
        </div>

        <button type="button" onClick={onLogout}>
          Log out
        </button>
      </header>

      <h2>Our pizzas</h2>

      {status === "loading" && (
        <p role="status">Loading pizzas...</p>
      )}

      {status === "error" && (
        <div>
          <p role="alert">{message}</p>

          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {status === "expired" && (
        <div>
          <p role="alert">{message}</p>

          <button type="button" onClick={onLogout}>
            Back to login
          </button>
        </div>
      )}

      {status === "success" && pizzas.length === 0 && (
        <p>No pizzas are available right now.</p>
      )}

      {status === "success" && pizzas.length > 0 && (
        <div className="pizza-grid">
          {pizzas.map((pizza) => (
            <article className="pizza-card" key={pizza.id}>
              <span className="pizza-icon" aria-hidden="true">
                🍕
              </span>

              <h3>{pizza.name}</h3>
              <p>{pizza.description}</p>
            </article>
          ))}
        </div>
      )}
      <PizzaBuilder accessToken={accessToken} onLogout={onLogout} />
    </section>
  );
}