import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { errorText } from "../../api";
import usePolling from "../../hooks/usePolling";
import { formatDate } from "../../utils";
import StatusBadge from "../../components/StatusBadge";
import PhotoUploader from "../../components/PhotoUploader";
import Field from "../../components/Field";

export default function TaskDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { data: a, error, loading, reload } = usePolling(() => api.get(`api/assignments/${id}`).then((r) => r.data.assignment), [id], 30000);
  const [actionError, setActionError] = useState(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [produced, setProduced] = useState("");

  if (loading) return <p className="center muted">{t("common.loading")}</p>;
  if (error || !a) return <p className="alert" role="alert">{errorText(t, error)}</p>;

  async function run(fn) {
    try { await fn(); setActionError(null); await reload(); } catch (err) { setActionError(err); }
  }

  const respond = (action) => run(() => api.patch(`/api/assignments/${id}/response`, { action, reason: reason.trim() || undefined }));
  const markDone = (e) => { e.preventDefault(); return run(() => api.patch(`/api/assignments/${id}/done`, { producedQty: Number(produced === "" ? a.quantity : produced) })); };
  const uploadPhotos = (files) => {
    const form = new FormData();
    files.forEach((f) => form.append("photos", f));
    return run(() => api.post(`/api/assignments/${id}/evidence`, form));
  };

  return (
    <>
      <p><Link to="/captain">← {t("common.back")}</Link></p>
      <div className="stack">
        <section className="card stack">
          <div className="row between">
            <h1 style={{ margin: 0 }}>{a.item}</h1>
            <StatusBadge status={a.status} />
          </div>
          <p style={{ margin: 0, fontSize: "1.15rem" }}>
            <strong>{t("captain.pieces", { n: a.quantity })}</strong><br />
            <span className="muted">{t("captain.due", { date: formatDate(a.deadline, i18n.language) })}</span>
          </p>
          <p className="muted small" style={{ margin: 0 }}>{a.orderRef}</p>
        </section>

        {a.referenceMedia.length > 0 && (
          <section className="card">
            <h2>{t("captain.reference")}</h2>
            <div className="gallery">
              {a.referenceMedia.map((m) => <a key={m.id} className="thumb" href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" loading="lazy" /></a>)}
            </div>
          </section>
        )}

        {a.status === "assigned" && (
          <section className="card stack">
            <h2>{t("captain.respondTitle")}</h2>
            {declining ? (
              <>
                <Field label={t("captain.declineReason")}>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
                </Field>
                <div className="row">
                  <button type="button" className="btn btn-danger" onClick={() => respond("decline")}>{t("captain.decline")}</button>
                  <button type="button" className="btn btn-outline" onClick={() => setDeclining(false)}>{t("common.cancel")}</button>
                </div>
              </>
            ) : (
              <div className="row">
                <button type="button" className="btn btn-turmeric grow" onClick={() => respond("accept")}>{t("captain.accept")}</button>
                <button type="button" className="btn btn-outline grow" onClick={() => setDeclining(true)}>{t("captain.decline")}</button>
              </div>
            )}
          </section>
        )}

        {a.status === "declined" && <p className="alert alert-info">{t("captain.declinedNote")}</p>}

        {["accepted", "done"].includes(a.status) && (
          <section className="card stack">
            <h2>{t("captain.proofTitle")}</h2>
            {a.status === "accepted" && <p className="muted small" style={{ margin: 0 }}>{t("captain.proofHelp")}</p>}
            {a.evidence.length > 0 && (
              <div className="gallery">
                {a.evidence.map((m) => <a key={m.id} className="thumb" href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" loading="lazy" /></a>)}
              </div>
            )}
            <PhotoUploader label={t("captain.addPhotos")} onUpload={uploadPhotos} />
            {a.evidence.length > 0 && (
              <p className={a.evidenceApproved ? "alert alert-ok" : "alert alert-info"}>
                {a.evidenceApproved ? t("captain.approvedNote") : t("captain.waitingNote")}
              </p>
            )}
          </section>
        )}

        {a.status === "accepted" && (
          <form className="card stack" onSubmit={markDone}>
            <h2>{t("captain.finishTitle")}</h2>
            <Field label={t("captain.producedQty")}>
              <input type="number" min="0" inputMode="numeric" placeholder={String(a.quantity)} value={produced} onChange={(e) => setProduced(e.target.value)} />
            </Field>
            <button type="submit" className="btn btn-turmeric btn-block">{t("captain.markDone")}</button>
          </form>
        )}

        {a.status === "done" && (
          <p className="alert alert-ok">{t("captain.doneNote", { n: a.producedQty })}</p>
        )}

        {actionError && <p className="alert" role="alert">{errorText(t, actionError)}</p>}
      </div>
    </>
  );
}
