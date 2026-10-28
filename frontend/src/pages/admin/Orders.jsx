import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { errorText } from "../../api";
import { ORDER_STATUSES } from "../../constants";
import usePolling from "../../hooks/usePolling";
import { formatDate } from "../../utils";
import StatusBadge from "../../components/StatusBadge";
import Pager from "../../components/Pager";

const LIMIT = 20;

export default function AdminOrders() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState("");
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, error, loading, reload } = usePolling(
    () =>
      api
        .get("/orders", { params: { status: status || undefined, q: search || undefined, page, limit: LIMIT } })
        .then((r) => r.data),
    [status, search, page],
    30000
  );

  const pick = (s) => { setStatus(s); setPage(1); };
  const submit = (e) => { e.preventDefault(); setSearch(typed.trim()); setPage(1); };

  return (
    <>
      <div className="row between">
        <h1>{t("nav.orders")}</h1>
        <button type="button" className="btn btn-outline btn-small" onClick={reload}>{t("common.refresh")}</button>
      </div>

      <form className="row" onSubmit={submit} role="search" style={{ marginBottom: 12 }}>
        <input className="select grow" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t("orders.searchPlaceholder")} aria-label={t("common.search")} />
        <button type="submit" className="btn">{t("common.search")}</button>
      </form>

      <div className="chips" style={{ marginBottom: 12 }}>
        {["", ...ORDER_STATUSES].map((s) => (
          <button key={s || "all"} type="button" className="chip" aria-pressed={status === s} onClick={() => pick(s)}>
            {s ? t(`status.${s}`) : t("orders.all")}
          </button>
        ))}
      </div>

      {error && !data && <p className="alert" role="alert">{errorText(t, error)}</p>}
      {loading && <p className="muted">{t("common.loading")}</p>}
      {data && data.items.length === 0 && <p className="center muted">{t("orders.none")}</p>}

      <div className="stack">
        {data && data.items.map((o) => (
          <Link key={o.id} to={`/admin/orders/${o.id}`} className="card">
            <div className="row between">
              <h3>{o.businessName}</h3>
              <StatusBadge status={o.status} />
            </div>
            <p style={{ margin: 0 }}>{o.quantity} × {o.item}</p>
            <p className="muted small" style={{ margin: "4px 0 8px" }}>
              {o.orderRef} · {t("orders.delivery", { date: formatDate(o.deliveryDate, i18n.language) })}
            </p>
            <div className="progress" aria-hidden="true"><span style={{ width: `${Math.min(100, (o.assignedQty / o.quantity) * 100)}%` }} /></div>
            <p className="muted small" style={{ margin: "4px 0 0" }}>{t("orders.assignedOf", { assigned: o.assignedQty, total: o.quantity })}</p>
          </Link>
        ))}
      </div>

      {data && <div style={{ marginTop: 16 }}><Pager page={page} total={data.total} limit={LIMIT} onPage={setPage} /></div>}
    </>
  );
}
