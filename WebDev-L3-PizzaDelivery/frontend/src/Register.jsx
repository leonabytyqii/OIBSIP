import { useState } from "react";

export default function Register() {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (status === "loading") return;

    const form = event.currentTarget;
    const fields = new FormData(form);

    const name = String(fields.get("name") || "").trim();
    const email = String(fields.get("email") || "").trim();
    const password = String(fields.get("password") || "");
    const confirmPassword = String(
      fields.get("confirmPassword") || ""
    );

    if (Array.from(password).length < 12) {
      setStatus("error");
      setMessage("Password must contain at least 12 characters.");
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      setStatus("error");
      setMessage("Password is too long. Please use a shorter one.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message || "Registration failed.");
        return;
      }

      form.reset();
      setStatus("success");
      setMessage(data.message || "Account created.");
    } catch {
      setStatus("error");
      setMessage("Unable to connect. Please try again.");
    }
  }

  return (
    <main className="card">
      <h1>Pizza Delivery</h1>
      <h2>Create an account</h2>

      {status !== "success" && (
        <form
          className="auth-form"
          method="post"
          onSubmit={handleSubmit}
        >
          <fieldset disabled={status === "loading"}>
            <label>
              Name
              <input
                type="text"
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                name="email"
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </label>

            <small>Use at least 12 characters.</small>

            <label>
              Confirm password
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </label>

            <button type="submit">
              {status === "loading"
                ? "Creating account..."
                : "Create account"}
            </button>
          </fieldset>
        </form>
      )}

      {message && (
        <p role={status === "error" ? "alert" : "status"}>
          {message}
        </p>
      )}

      <p>
        <a href="/login">Already have an account? Log in</a>
      </p>
    </main>
  );
}