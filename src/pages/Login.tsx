import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../lib/appContext";

export default function Login() {
  const {
    user,
    signIn,
    signUp,
    signInWithGoogle,
    verifyPhoneOtp,
    resendPhoneOtp,
  } = useApp();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpPhone, setOtpPhone] = useState("");

  const handleSubmit = async () => {
    setError(null);
    setBusy(true);
    const result = mode === "signin" ? await signIn(identifier, password) : null;
    if (mode === "signin") {
      setBusy(false);
      if (result) {
        setError(result);
        return;
      }
      navigate("/");
      return;
    }

    const signupResult = await signUp(firstName, lastName, identifier, password);
    setBusy(false);
    if (signupResult.error) {
      setError(signupResult.error);
      return;
    }
    if (signupResult.needsVerification && signupResult.phone) {
      setOtpPhone(signupResult.phone);
      setOtpMode(true);
      setOtpCode("");
      return;
    }
    navigate("/");
  };

  const handleVerify = async () => {
    setError(null);
    setBusy(true);
    const result = await verifyPhoneOtp(otpPhone, otpCode.trim());
    setBusy(false);
    if (result) {
      setError(result);
      return;
    }
    navigate("/");
  };

  const handleResend = async () => {
    setError(null);
    setBusy(true);
    const result = await resendPhoneOtp(otpPhone);
    setBusy(false);
    if (result) {
      setError(result);
    }
  };

  if (user) {
    return (
      <section className="card auth-card auth-card--wide">
        <h2>You are already signed in</h2>
        <p className="muted">Continue to the dashboard to start working.</p>
        <button className="app__primary" onClick={() => navigate("/")}>
          Go to dashboard
        </button>
      </section>
    );
  }

  return (
    <section className="auth-shell">
      <div className="auth-shell__visual">
        <div className="auth-brand">
          <img className="brand-logo" src="/logo.png" alt="PhiriTill logo" />
          <div>
            <p className="auth-brand__name">PhiriTill</p>
            <p className="muted">Smart POS for modern retail</p>
          </div>
        </div>
        <div className="auth-orb" />
        <div className="auth-orb auth-orb--alt" />
        <div className="auth-shell__copy">
          <h1>Run your shop in real time.</h1>
          <p className="muted">
            Sell faster, manage stock instantly, and track performance from any
            phone. Built for busy counters.
          </p>
          <div className="auth-tags">
            <span>Realtime stock</span>
            <span>Secure checkout</span>
            <span>Mobile-first</span>
          </div>
        </div>
      </div>

      <div className="auth-card auth-card--wide">
        <div className="auth-card__header">
          <div>
            <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
            <p className="muted">
              {mode === "signin"
                ? "Sign in to continue with your store."
                : "Start selling in minutes."}
            </p>
          </div>
        </div>
        <div className="auth">
          <div className="auth__fields">
            {mode === "signup" && !otpMode ? (
              <div className="field-row">
                <label className="field">
                  <span>First name</span>
                  <input
                    type="text"
                    placeholder="e.g. Kelvin"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Last name</span>
                  <input
                    type="text"
                    placeholder="e.g. Phiri"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            <label className="field">
              <span>Email or phone</span>
              <input
                type="text"
                placeholder="email@store.com or +260..."
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                disabled={otpMode}
              />
            </label>
            {!otpMode ? (
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            ) : (
              <label className="field">
                <span>Verification code</span>
                <input
                  type="text"
                  placeholder="Enter SMS code"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                />
              </label>
            )}
          </div>
          {error ? <p className="error">{error}</p> : null}
          <div className="auth__actions">
            {!otpMode ? (
              <button className="app__primary" onClick={handleSubmit}>
                {busy
                  ? "Working..."
                  : mode === "signin"
                      ? "Sign in"
                      : "Create account"}
              </button>
            ) : (
              <button className="app__primary" onClick={handleVerify}>
                {busy ? "Verifying..." : "Verify phone"}
              </button>
            )}
            <button
              className="app__ghost"
              onClick={() =>
                setMode((prev) => (prev === "signin" ? "signup" : "signin"))
              }
              disabled={otpMode}
            >
              {mode === "signin" ? "Need an account?" : "Have an account?"}
            </button>
            {otpMode ? (
              <button className="app__ghost" onClick={handleResend}>
                Resend code
              </button>
            ) : null}
            <button
              className="app__ghost"
              onClick={() => {
                setError(null);
                void signInWithGoogle();
              }}
              disabled={otpMode}
            >
              Continue with Google
            </button>
          </div>
          <p className="auth-hint muted">
            Tip: Use E.164 phone format (e.g. +2609...) if signing up with
            phone.
          </p>
        </div>
      </div>
    </section>
  );
}
