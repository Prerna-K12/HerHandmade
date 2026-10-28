import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api";
import usePolling from "../hooks/usePolling";
import { formatDate } from "../utils";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import PostCard from "../components/PostCard";

// The worker link (/g/<code>): no login, read-only.
export default function GroupView() {
  const { code } = useParams();
  const { t, i18n } = useTranslation();
  const { data, error, loading, reload } = usePolling(
    () => api.get(`/public/group-view/${code}`).then((r) => r.data), [code], 30000
  );

  if (loading) return <Layout><p className="center muted">{t("common.loading")}</p></Layout>;
  if (!data) return <Layout><p className="alert" role="alert">{t("group.invalid")}</p></Layout>;

  return (
    <Layout>
      <div className="row between">
        <div>
          <h1>{data.group.name}</h1>
          <p className="muted">{data.group.village}, {data.group.district}</p>
        </div>
        <button type="button" className="btn btn-outline btn-small" onClick={reload}>{t("common.refresh")}</button>
      </div>
      {error && <p className="alert">{t("errors.NETWORK_ERROR")}</p>}

      <h2 style={{ marginTop: 18 }}>{t("group.tasks")}</h2>
      {data.tasks.length === 0 ? (
        <p className="muted">{t("group.noTasks")}</p>
      ) : (
        <div className="stack">
          {data.tasks.map((task) => (
            <div key={task.id} className={`card${task.status === "accepted" ? " current" : ""}`}>
              <div className="row between">
                <h3>{task.item}</h3>
                <StatusBadge status={task.status} />
              </div>
              <p className="muted" style={{ margin: 0 }}>
                {t("captain.pieces", { n: task.quantity })} · {t("captain.due", { date: formatDate(task.deadline, i18n.language) })}
              </p>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: 22 }}>{t("group.feed")}</h2>
      <div className="stack">
        {data.feed.length === 0 && <p className="muted">{t("posts.none")}</p>}
        {data.feed.map((p) => <PostCard key={p.id} post={p} />)}
      </div>
      <hr className="stitch" />
      <p className="muted small">{t("group.readOnly")}</p>
    </Layout>
  );
}
