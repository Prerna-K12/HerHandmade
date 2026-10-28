import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../../api";
import usePolling from "../../hooks/usePolling";
import { formatDate } from "../../utils";
import Layout from "../../components/Layout";
import StatusBadge from "../../components/StatusBadge";

export default function TrackOrder() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const { data, error, loading } = usePolling(() => api.get(`/public/track/${token}`).then((r) => r.data), [token], 60000);
  const date = (v) => formatDate(v, i18n.language);

  if (loading) return <Layout><p className="center muted">{t("common.loading")}</p></Layout>;
  if (error || !data) return <Layout><p className="alert" role="alert">{t("track.notFound")}</p></Layout>;

  return (
    <Layout>
      <div className="hero">
        <div className="weave" aria-hidden="true" />
        <div className="hero-body stack">
          <p className="muted small" style={{ margin: 0 }}>{t("track.title")} · {data.orderRef}</p>
          <h1>{data.quantity} × {data.item}</h1>
          <div className="row">
            <StatusBadge status={data.status} />
            <span className="muted small">{t("track.deliveryBy", { date: date(data.deliveryDate) })}</span>
          </div>
        </div>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t("track.progress")}</h2>
        <ol className="thread">
          {data.timeline.map((e, i) => (
            <li key={i}>
              <strong>{t(`status.${e.status}`)}</strong>
              <span className="when">{date(e.at)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t("track.photos")}</h2>
        {data.photos.length === 0 ? (
          <p className="muted">{t("track.photosEmpty")}</p>
        ) : (
          <div className="figures">
            {data.photos.map((p) => (
              <figure key={p.id}>
                <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.label} loading="lazy" /></a>
                <figcaption>{p.label}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <hr className="stitch" />
      <p className="muted">
        {t("track.contact", { ngo: data.ngo.name })}
        {data.ngo.email && <><br /><a href={`mailto:${data.ngo.email}`}>{data.ngo.email}</a></>}
        {data.ngo.phone && <><br /><a href={`tel:${data.ngo.phone}`}>{data.ngo.phone}</a></>}
      </p>
    </Layout>
  );
}
