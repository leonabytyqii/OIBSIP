import { useState } from "react";
import Dashboard from "./Dashboard";
import AdminDashboard from "./AdminDashboard";

export default function Login({ adminOnly = false }) {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [session, setSession] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();

    if (status === "loading") return;

    const form = event.currentTarget;
    const fields = new FormData(form);

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: String(fields.get("email") || "").trim(),
            password: String(fields.get("password") || ""),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message || "Login failed.");
        return;
      }

      if (
        typeof data.accessToken !== "string" ||
        !data.accessToken
      ) {
        setStatus("error");
        setMessage("Invalid login response. Please try again.");
        return;
      }

      const profileResponse = await fetch(
        "http://localhost:5000/api/auth/me",
        {
          headers: {
            Authorization: `Bearer ${data.accessToken}`,
          },
          cache: "no-store",
        }
      );

      const profileData = await profileResponse.json();

      if (!profileResponse.ok) {
        setStatus("error");
        setMessage(
          profileData.message || "Unable to load your profile."
        );
        return;
      }

      const user = profileData.user;

      if (!user || !["user", "admin"].includes(user.role)) {
        setStatus("error");
        setMessage("Invalid user profile. Please try again.");
        return;
      }

      if (adminOnly && user.role !== "admin") {
        setStatus("error");
        setMessage(
          "This page is for administrators. Please use customer login."
        );
        return;
      }

      if (!adminOnly && user.role === "admin") {
        setStatus("error");
        setMessage(
          "Please use the admin login page for this account."
        );
        return;
      }

      form.reset();

      setSession({
        accessToken: data.accessToken,
        user,
      });

      setStatus("success");
      setMessage("");
    } catch {
      setStatus("error");
      setMessage("Unable to connect. Please try again.");
    }
  }

  function logout() {
    setSession(null);
    setStatus("idle");
    setMessage("");
  }

  if (session) {
    return (
      <main className="card">
        <h1>Pizza Delivery</h1>

        {session.user.role === "admin" ? (
          <AdminDashboard
            user={session.user}
            accessToken={session.accessToken}
            onLogout={logout}
          />
        ) : (
          <Dashboard
            user={session.user}
            accessToken={session.accessToken}
            onLogout={logout}
          />
        )}
      </main>
    );
  }

  return (
    <main className="card">
      <h1>Pizza Delivery</h1>

      <h2>{adminOnly ? "Admin login" : "Customer login"}</h2>

      {adminOnly && (
        <p>Sign in with your administrator account.</p>
      )}

      <form
        className="auth-form"
        method="post"
        onSubmit={handleSubmit}
      >
        <fieldset disabled={status === "loading"}>
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="username"
              maxLength={254}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit">
            {status === "loading"
              ? "Logging in..."
              : adminOnly
                ? "Log in as admin"
                : "Login"}
          </button>
        </fieldset>
      </form>

      {message && <p role="alert">{message}</p>}

      <p>
        <a href="/forgot-password">Forgot password?</a>
      </p>

      {adminOnly ? (
        <p>
          <a href="/login">Go to customer login</a>
        </p>
      ) : (
        <>
          <p>
            <a href="/register">Create an account</a>
          </p>

          <p>
            <a href="/admin/login">Admin login</a>
          </p>
        </>
      )}
    </main>
  );
}