import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { errorText } from "../api";
import { useAuth, homeFor } from "../context/AuthContext";
import Layout from "../components/Layout";
import Field from "../components/Field";

export default function Login() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(phone.trim(), password);
      navigate(homeFor(u), { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Layout>
      <h1>{t("login.title")}</h1>
      <p className="muted">{t("login.help")}</p>
      <form className="card stack" onSubmit={submit}>
        <Field label={t("common.phone")}>
          <input type="tel" inputMode="tel" autoComplete="username" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </Field>
        <Field label={t("common.password")}>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <p className="alert" role="alert">{errorText(t, error)}</p>}
        <button type="submit" className="btn btn-block" disabled={busy}>{t("login.submit")}</button>
      </form>
    </Layout>
  );
}
