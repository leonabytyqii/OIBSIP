import { useState } from "react";

export default function PasswordRecovery() {
  const isResetPage = window.location.pathname === "/reset-password";

  const [token] = useState(() => {
    return new URLSearchParams(window.location.search).get("token") || "";
  });

  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const validToken = /^[a-f0-9]{64}$/.test(token);

  async function handleSubmit(event) {
    event.preventDefault();

    if (
      status === "loading" ||
      (isResetPage && status === "success")
    ) {
      return;
    }

    const form = event.currentTarget;
    const fields = new FormData(form);

    const password = String(fields.get("password") || "");
    const confirmPassword = String(fields.get("confirmPassword") || "");

    if (isResetPage) {
      if (
        Array.from(password).length < 12 ||
        new TextEncoder().encode(password).length > 72
      ) {
        setStatus("error");
        setMessage(
          "Password must have at least 12 characters and at most 72 bytes."
        );
        return;
      }

      if (password !== confirmPassword) {
        setStatus("error");
        setMessage("Passwords do not match.");
        return;
      }
    }

    setStatus("loading");
    setMessage("");

    try {
      const endpoint = isResetPage
        ? "reset-password"
        : "forgot-password";

      const body = isResetPage
        ? { token, password, confirmPassword }
        : { email: String(fields.get("email") || "").trim() };

      const response = await fetch(
        `http://localhost:5000/api/auth/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          referrerPolicy: "no-referrer",
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message || "Please try again.");
        return;
      }

      setStatus("success");
      setMessage(data.message);

      if (isResetPage) {
        form.reset();

        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname
        );
      }
    } catch {
      setStatus("error");
      setMessage("Unable to connect. Please try again.");
    }
  }

  if (isResetPage && !validToken) {
    return (
      <main className="card">
        <h1>Pizza Delivery</h1>
        <h2>Invalid reset link</h2>
        <a href="/forgot-password">Request a new link</a>
      </main>
    );
  }

  return (
    <main className="card">
      <h1>Pizza Delivery</h1>

      <h2>
        {isResetPage ? "Choose a new password" : "Forgot password"}
      </h2>

      {(!isResetPage || status !== "success") && (
        <form
          className="auth-form"
          method="post"
          onSubmit={handleSubmit}
        >
          <fieldset disabled={status === "loading"}>
            {isResetPage ? (
              <>
                <label>
                  New Pizza Delivery password
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={72}
                    required
                  />
                </label>

                <label>
                  Confirm new password
                  <input
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={72}
                    required
                  />
                </label>

                <small>Use at least 12 characters.</small>
              </>
            ) : (
              <label>
                Your email address
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </label>
            )}

            <button type="submit">
              {status === "loading"
                ? "Please wait..."
                : isResetPage
                  ? "Save new password"
                  : "Send reset link"}
            </button>
          </fieldset>
        </form>
      )}

      {message && (
        <p role={status === "error" ? "alert" : "status"}>
          {message}
        </p>
      )}

      {!isResetPage && status === "success" && (
        <p>Check your inbox and spam folder.</p>
      )}

      {isResetPage && status !== "success" && (
        <p>
          <a href="/forgot-password">Request a new link</a>
        </p>
      )}
    </main>
  );
}