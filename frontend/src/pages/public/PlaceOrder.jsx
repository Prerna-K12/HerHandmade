import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { errorText } from "../../api";
import { todayStr } from "../../constants";
import Layout from "../../components/Layout";
import Field from "../../components/Field";
import { newUuid } from "../../utils";
// One key per order, kept in sessionStorage. A page refresh or a retry after a bad connection
// sends the SAME key, so the server returns the first order instead of creating a second one.
function getOrderKey() {
  try {
    let key = sessionStorage.getItem("orderKey");
    if (!key) {
      key = newUuid();
      sessionStorage.setItem("orderKey", key);
    }
    return key;
  } catch {
    return newUuid(); // storage blocked (private mode): still protects against a double click
  }
}
const EMPTY = { businessName: "", location: "", item: "", quantity: "", deliveryDate: "", email: "", phone: "", website: "" };

export default function PlaceOrder() {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [orderKey] = useState(getOrderKey);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  function validate() {
    const e = {};
    for (const key of ["businessName", "location", "item"]) if (!form[key].trim()) e[key] = t("form.required");
    if (!(Number(form.quantity) >= 1)) e.quantity = t("form.quantity");
    if (!form.deliveryDate || form.deliveryDate <= todayStr()) e.deliveryDate = t("form.date");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = t("form.email");
    return e;
  }

  async function submit(ev) {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setApiError(null);
    try {
      const res = await api.post("/public/orders", {
        ...form,
        quantity: Number(form.quantity),
        email: form.email.trim(),
        idempotencyKey: orderKey,
      });
      try { sessionStorage.removeItem("orderKey"); } catch { /* ignore */ }
      setDone(res.data);     
    } catch (err) {
      setApiError(err);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const token = done.trackingUrl.split("/").pop();
    return (
      <Layout>
        <div className="card stack">
          <h1>{t("order.successTitle")}</h1>
          <p className="alert alert-ok">{t("order.successText")}</p>
          <p>{t("order.reference")}: <strong>{done.orderRef}</strong></p>
          <Link className="btn" to={`/track/${token}`}>{t("order.openTracking")}</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1>{t("order.title")}</h1>
      <form className="card stack" onSubmit={submit} noValidate>
        <Field label={t("order.businessName")} error={errors.businessName}>
          <input value={form.businessName} onChange={set("businessName")} autoComplete="organization" maxLength={120} />
        </Field>
        <Field label={t("order.location")} error={errors.location}>
          <input value={form.location} onChange={set("location")} autoComplete="address-level2" maxLength={200} />
        </Field>
        <Field label={t("order.item")} error={errors.item} hint={t("order.itemHint")}>
          <input value={form.item} onChange={set("item")} maxLength={200} />
        </Field>
        <Field label={t("order.quantity")} error={errors.quantity}>
          <input type="number" inputMode="numeric" min="1" value={form.quantity} onChange={set("quantity")} />
        </Field>
        <Field label={t("order.deliveryDate")} error={errors.deliveryDate}>
          <input type="date" min={todayStr()} value={form.deliveryDate} onChange={set("deliveryDate")} />
        </Field>
        <Field label={t("order.email")} error={errors.email}>
          <input type="email" inputMode="email" value={form.email} onChange={set("email")} autoComplete="email" />
        </Field>
        <Field label={`${t("order.phone")} (${t("common.optional")})`}>
          <input type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
        </Field>

        {/* Honeypot: hidden from people, bots fill it in. */}
        <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set("website")} />

        {apiError && <p className="alert" role="alert">{errorText(t, apiError)}</p>}
        <button type="submit" className="btn btn-turmeric btn-block" disabled={busy}>
          {busy ? t("common.loading") : t("order.submit")}
        </button>
      </form>
    </Layout>
  );
}
