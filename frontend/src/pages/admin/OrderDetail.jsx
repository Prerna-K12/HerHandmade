import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { errorText } from "../../api";
import { TRANSITIONS, todayStr } from "../../constants";
import usePolling from "../../hooks/usePolling";
import { formatDate } from "../../utils";
import StatusBadge from "../../components/StatusBadge";
import PhotoUploader from "../../components/PhotoUploader";
import Field from "../../components/Field";

const Stars = ({ n }) => (
  <span className="stars" role="img" aria-label={`${n}/5`}>
    {"★".repeat(n)}<span className="off">{"★".repeat(5 - n)}</span>
  </span>
);

export default function OrderDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const [actionError, setActionError] = useState(null);
  const { data, error, loading, reload } = usePolling(() => api.get(`/orders/${id}`).then((r) => r.data), [id], 30000);

  if (loading) return <p className="center muted">{t("common.loading")}</p>;
  if (error || !data) return <p className="alert" role="alert">{errorText(t, error)}</p>;

  const { order, events, assignments } = data;
  const date = (v) => formatDate(v, i18n.language);
  const remaining = order.quantity - order.assignedQty;

  async function move(status) {
    if (["rejected", "cancelled"].includes(status) && !window.confirm(t("common.confirm"))) return;
    try {
      await api.patch(`/orders/${id}/status`, { status });
      setActionError(null);
      await reload();
    } catch (err) {
      setActionError(err);
    }
  }

  const copyLink = () => navigator.clipboard && navigator.clipboard.writeText(order.trackingUrl).then(() => window.alert(t("common.copied")));

  return (
    <>
      <p><Link to="/admin/orders">← {t("common.back")}</Link></p>
      <div className="cols cols-2">
        {/* ---------- left: the order ---------- */}
        <div className="stack">
          <section className="card stack">
            <div className="row between">
              <h1 style={{ margin: 0 }}>{order.orderRef}</h1>
              <StatusBadge status={order.status} />
            </div>
            <p style={{ margin: 0 }}><strong>{order.quantity} × {order.item}</strong></p>
            <p className="muted" style={{ margin: 0 }}>{t("orders.delivery", { date: date(order.deliveryDate) })}</p>
            <hr className="stitch" style={{ margin: "4px 0" }} />
            <h3>{t("detail.business")}</h3>
            <p style={{ margin: 0 }}>
              <strong>{order.businessName}</strong><br />
              {order.location}<br />
              <a href={`mailto:${order.email}`}>{order.email}</a>
              {order.phone && <><br /><a href={`tel:${order.phone}`}>{order.phone}</a></>}
            </p>
            <button type="button" className="btn btn-outline btn-small" onClick={copyLink}>{t("detail.copyTracking")}</button>
          </section>

          <section className="card stack">
            <h2>{t("detail.actions")}</h2>
            <div className="row">
              {(TRANSITIONS[order.status] || []).map((s) => (
                <button key={s} type="button" className={`btn ${["rejected", "cancelled"].includes(s) ? "btn-danger" : ""}`} onClick={() => move(s)}>
                  {t(`orderAction.${s}`)}
                </button>
              ))}
              {!TRANSITIONS[order.status] && <p className="muted" style={{ margin: 0 }}>{t("detail.finalStatus")}</p>}
            </div>
            {actionError && <p className="alert" role="alert">{errorText(t, actionError)}</p>}
          </section>

          <section className="card">
            <h2>{t("detail.timeline")}</h2>
            <ol className="thread">
              {events.map((e, i) => (
                <li key={i}>
                  <strong>{t(`status.${e.status}`)}</strong>
                  <span className="when">{date(e.at)}{e.by ? ` · ${e.by}` : ""}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* ---------- right: groups and assignments ---------- */}
        <div className="stack">
          {["accepted", "in_production"].includes(order.status) && (
            <GroupFinder order={order} remaining={remaining} onAssigned={reload} />
          )}

          <section className="stack">
            <h2 style={{ margin: 0 }}>{t("detail.assignments")}</h2>
            {assignments.length === 0 && <p className="muted">{t("detail.noAssignments")}</p>}
            {assignments.map((a) => <AssignmentCard key={a.id} a={a} onChange={reload} />)}
          </section>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Type "rakhi" -> the top 10 groups, with a Best rated / Fastest available switch.
// ---------------------------------------------------------------------------
function GroupFinder({ order, remaining, onAssigned }) {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("best_rated");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [assigning, setAssigning] = useState(null); // groupId
  const [qty, setQty] = useState("");
  const [deadline, setDeadline] = useState("");
  const [formError, setFormError] = useState(null);

  async function run(nextMode = mode) {
    setError(null);
    try {
      const res = await api.get("/groups/match", { params: { q: q.trim(), mode: nextMode } });
      setResult(res.data);
    } catch (err) {
      setResult(null);
      setError(err);
    }
  }

  const submit = (e) => { e.preventDefault(); if (q.trim()) run(); };
  const switchMode = (m) => { setMode(m); if (q.trim()) run(m); };

  function openAssign(groupId) {
    setAssigning(groupId);
    setQty(String(remaining));
    setDeadline("");
    setFormError(null);
  }

  async function assign(e) {
    e.preventDefault();
    try {
      await api.post(`/orders/${order.id}/api/assignments`, { groupId: assigning, quantity: Number(qty), deadline });
      setAssigning(null);
      await Promise.all([onAssigned(), run()]);
    } catch (err) {
      setFormError(err);
    }
  }

  return (
    <section className="card stack">
      <h2>{t("detail.find")}</h2>
      <p className="muted small" style={{ margin: 0 }}>{t("detail.remaining", { n: remaining })}</p>
      <form className="row" onSubmit={submit} role="search">
        <input className="select grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("detail.findHint")} aria-label={t("detail.find")} />
        <button type="submit" className="btn">{t("common.search")}</button>
      </form>
      <div className="seg" role="group" aria-label={t("detail.sort")}>
        <button type="button" aria-pressed={mode === "best_rated"} onClick={() => switchMode("best_rated")}>{t("detail.bestRated")}</button>
        <button type="button" aria-pressed={mode === "fastest"} onClick={() => switchMode("fastest")}>{t("detail.fastest")}</button>
      </div>

      {error && <p className="alert" role="alert">{errorText(t, error)}</p>}
      {result && result.results.length === 0 && <p className="muted">{t("detail.noGroups")}</p>}

      {result && result.results.map((g) => (
        <div key={g.groupId} className="card stack" style={{ background: "var(--wash)" }}>
          <div className="row between">
            <h3 style={{ margin: 0 }}>{g.name}</h3>
            <Stars n={g.rating} />
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            {g.village}, {g.district}{g.verified ? ` · ✓ ${t("captains.verified")}` : ""}
          </p>
          <p style={{ margin: 0 }}>
            {g.nextFreeDate
              ? <strong>{t("detail.freeFrom", { date: formatDate(g.nextFreeDate, i18n.language) })}</strong>
              : <strong style={{ color: "var(--leaf)" }}>{t("detail.freeNow")}</strong>}
            {g.currentTask && (
              <span className="muted small"><br />{t("detail.currentTask", { item: g.currentTask.item, date: formatDate(g.currentTask.deadline, i18n.language) })}</span>
            )}
          </p>

          {assigning === g.groupId ? (
            <form className="stack" onSubmit={assign}>
              <Field label={t("common.quantity")}>
                <input type="number" min="1" max={remaining} value={qty} onChange={(e) => setQty(e.target.value)} required />
              </Field>
              <Field label={t("common.deadline")}>
                <input type="date" min={todayStr()} max={order.deliveryDate} value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
              </Field>
              {formError && <p className="alert" role="alert">{errorText(t, formError)}</p>}
              <div className="row">
                <button type="submit" className="btn">{t("detail.assign")}</button>
                <button type="button" className="btn btn-outline" onClick={() => setAssigning(null)}>{t("common.cancel")}</button>
              </div>
            </form>
          ) : (
            <button type="button" className="btn btn-turmeric" disabled={remaining <= 0} onClick={() => openAssign(g.groupId)}>
              {t("detail.assignTo", { name: g.name })}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// One assignment: reference images (admin -> group), proof photos (group -> admin -> business)
// ---------------------------------------------------------------------------
function AssignmentCard({ a, onChange }) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState(null);

  async function run(fn) {
    try { await fn(); setError(null); await onChange(); } catch (err) { setError(err); }
  }

  const uploadReference = (files) => {
    const form = new FormData();
    files.forEach((f) => form.append("images", f));
    return run(() => api.post(`/api/assignments/${a.id}/reference`, form));
  };
  const removePhoto = (m) => window.confirm(t("common.confirm")) && run(() => api.delete(`/api/assignments/${a.id}/evidence/${m.id}`));
  const setApproved = (approved) => run(() => api.patch(`/api/assignments/${a.id}/approve`, { approved }));

  return (
    <article className="card stack">
      <div className="row between">
        <h3 style={{ margin: 0 }}>{a.groupName}</h3>
        <StatusBadge status={a.status} />
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {a.village}, {a.district} · {t("captain.pieces", { n: a.quantity })} · {t("captain.due", { date: formatDate(a.deadline, i18n.language) })}
        {a.producedQty != null && ` · ${t("detail.produced", { n: a.producedQty })}`}
      </p>
      {a.declineReason && <p className="alert alert-info">{a.declineReason}</p>}

      <div>
        <h3>{t("detail.reference")}</h3>
        {a.referenceMedia.length > 0 && (
          <div className="gallery" style={{ marginBottom: 8 }}>
            {a.referenceMedia.map((m) => <a key={m.id} className="thumb" href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" loading="lazy" /></a>)}
          </div>
        )}
        <PhotoUploader label={t("detail.addReference")} max={3} onUpload={uploadReference} />
      </div>

      <div>
        <h3>{t("detail.proof")}</h3>
        {a.evidence.length === 0 ? (
          <p className="muted small">{t("detail.noProof")}</p>
        ) : (
          <>
            <div className="gallery" style={{ marginBottom: 8 }}>
              {a.evidence.map((m) => (
                <div key={m.id} className="thumb">
                  <a href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" loading="lazy" /></a>
                  <button type="button" className="x" aria-label={t("common.delete")} onClick={() => removePhoto(m)}>×</button>
                </div>
              ))}
            </div>
            <p className={a.evidenceApproved ? "alert alert-ok" : "alert alert-info"}>
              {a.evidenceApproved ? t("detail.approvedNote") : t("detail.awaitingReview")}
            </p>
            <button type="button" className={`btn ${a.evidenceApproved ? "btn-outline" : "btn-turmeric"}`} style={{ marginTop: 8 }} onClick={() => setApproved(!a.evidenceApproved)}>
              {a.evidenceApproved ? t("detail.unapprove") : t("detail.approve")}
            </button>
          </>
        )}
      </div>
      {error && <p className="alert" role="alert">{errorText(t, error)}</p>}
    </article>
  );
}
