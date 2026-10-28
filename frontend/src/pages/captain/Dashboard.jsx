import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { errorText } from "../../api";
import { useAuth } from "../../context/AuthContext";
import usePolling from "../../hooks/usePolling";
import { formatDate } from "../../utils";
import StatusBadge from "../../components/StatusBadge";

function TaskCard({ a, current = false }) {
  const { t, i18n } = useTranslation();
  return (
    <Link to={`/captain/tasks/${a.id}`} className={`card${current ? " current" : ""}`}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>{a.item}</h3>
        <StatusBadge status={a.status} />
      </div>
      <p className="muted" style={{ margin: "4px 0 0" }}>
        {t("captain.pieces", { n: a.quantity })} · {t("captain.due", { date: formatDate(a.deadline, i18n.language) })}
      </p>
    </Link>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, error, loading, reload } = usePolling(() => api.get("api/assignments").then((r) => r.data.assignments), [], 30000);

  const accepted = (data || []).filter((a) => a.status === "accepted");
  const requests = (data || []).filter((a) => a.status === "assigned");
  const finished = (data || []).filter((a) => a.status === "done").slice(0, 5);

  return (
    <>
      <div className="row between">
        <div>
          <h1>{t("captain.title")}</h1>
          {user && user.group && <p className="muted">{user.group.name}</p>}
        </div>
        <button type="button" className="btn btn-outline btn-small" onClick={reload}>{t("common.refresh")}</button>
      </div>

      {error && !data && <p className="alert" role="alert">{errorText(t, error)}</p>}
      {loading && <p className="muted">{t("common.loading")}</p>}

      {requests.length > 0 && (
        <section className="stack" style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>{t("captain.requests")}</h2>
          <p className="alert alert-info">{t("captain.requestsNote")}</p>
          {requests.map((a) => <TaskCard key={a.id} a={a} />)}
        </section>
      )}

      <section className="stack" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>{t("captain.current")}</h2>
        {data && accepted.length === 0 && <p className="muted">{t("captain.noTasks")}</p>}
        {accepted[0] && <TaskCard a={accepted[0]} current />}
      </section>

      {accepted.length > 1 && (
        <section className="stack" style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>{t("captain.upcoming")}</h2>
          {accepted.slice(1).map((a) => <TaskCard key={a.id} a={a} />)}
        </section>
      )}

      {finished.length > 0 && (
        <section className="stack">
          <h2 style={{ margin: 0 }}>{t("captain.finished")}</h2>
          {finished.map((a) => <TaskCard key={a.id} a={a} />)}
        </section>
      )}
    </>
  );
}
