import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth, homeFor } from "../context/AuthContext";
import Layout from "../components/Layout";

export default function Home() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to={homeFor(user)} replace />;

  return (
    <Layout>
      <section className="hero">
        <div className="weave" aria-hidden="true" />
        <div className="hero-body stack">
          <h1>{t("home.tagline")}</h1>
          <p>{t("home.lead")}</p>
          <Link className="btn btn-turmeric" to="/order">{t("home.placeOrder")}</Link>
          <Link className="btn btn-outline" to="/login">{t("home.staffLogin")}</Link>
          <p className="muted small">{t("home.trackHint")}</p>
        </div>
      </section>
    </Layout>
  );
}
