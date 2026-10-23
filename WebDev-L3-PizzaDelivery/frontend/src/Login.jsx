import { useState } from "react";

export default function Login() {
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
          headers: { "Content-Type": "application/json" },
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

setSession({
  accessToken: data.accessToken,
  user: profileData.user,
});
      form.reset();
      setStatus("success");
      setMessage(data.message);
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

  return (
    <main className="card">
      <h1>Pizza Delivery</h1>

      {session ? (
        <>
          <h2>Welcome, {session.user.name}!</h2>
          <p role="status">{message}</p>
          <button type="button" onClick={logout}>
            Log out
          </button>
        </>
      ) : (
        <>
          <h2>Login</h2>

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
                  autoComplete="current-password"
                  required
                />
              </label>

              <button type="submit">
                {status === "loading" ? "Logging in..." : "Login"}
              </button>
            </fieldset>
          </form>

          <a href="/forgot-password">Forgot password?</a>
          <p>
  <a href="/register">Create an account</a>
</p>

          {message && <p role="alert">{message}</p>}
        </>
      )}
    </main>
  );
}