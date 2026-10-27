import { useState } from "react";
import "./App.css";
import PasswordRecovery from "./PasswordRecovery";
import Login from "./Login";
import Register from "./Register";

function VerifyEmail() {
  const [token] = useState(() => {
    return new URLSearchParams(window.location.search).get("token") || "";
  });

  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const validToken = /^[a-f0-9]{64}$/.test(token);

  async function verifyEmail() {
    if (!validToken || status === "loading" || status === "success") {
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/verify-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message || "Email verification failed.");
        return;
      }

      setStatus("success");
      setMessage(data.message || "Email verified successfully.");

      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname
      );
    } catch {
      setStatus("error");
      setMessage("Unable to connect. Please try again.");
    }
  }

  return (
    <main className="card">
      <h1>Pizza Delivery</h1>

      <h2>
        {status === "success" ? "Email verified" : "Verify your email"}
      </h2>

      {status !== "success" && (
        <p>
          {validToken
            ? "Click the button below to confirm your email address."
            : "Open the verification link from your email."}
        </p>
      )}

      <button
        type="button"
        onClick={verifyEmail}
        disabled={
          !validToken || status === "loading" || status === "success"
        }
      >
        {status === "loading"
          ? "Verifying..."
          : status === "success"
            ? "Verified"
            : "Verify email"}
      </button>

      {message && (
        <p role={status === "error" ? "alert" : "status"}>
          {message}
        </p>
      )}

      {status === "success" && (
        <p>
          <a href="/login">Go to login</a>
        </p>
      )}
    </main>
  );
}

export default function App() {
  const pathname = window.location.pathname;

  if (pathname === "/" || pathname === "/login") {
    return <Login key="customer" />;
  }

  if (pathname === "/admin/login") {
    return <Login key="admin" adminOnly />;
  }

  if (pathname === "/register") {
    return <Register />;
  }

  if (pathname === "/verify-email") {
    return <VerifyEmail />;
  }

  if (
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  ) {
    return <PasswordRecovery key={pathname} />;
  }

  return (
    <main className="card">
      <h1>Pizza Delivery</h1>
      <h2>Page not found</h2>
      <p>The page you are looking for does not exist.</p>
      <a href="/login">Go to login</a>
    </main>
  );
}