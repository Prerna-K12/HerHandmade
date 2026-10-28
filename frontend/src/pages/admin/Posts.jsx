import { useState } from "react";
import { useTranslation } from "react-i18next";
import api, { errorText } from "../../api";
import usePolling from "../../hooks/usePolling";
import PostForm from "../../components/PostForm";
import PostCard from "../../components/PostCard";
import Pager from "../../components/Pager";

const LIMIT = 10;

export default function AdminPosts() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const captains = usePolling(() => api.get("/captains").then((r) => r.data.captains), []);
  const feed = usePolling(() => api.get("/broadcasts", { params: { page, limit: LIMIT } }).then((r) => r.data), [page], 30000);

  async function remove(post) {
    if (!window.confirm(t("common.confirm"))) return;
    try { await api.delete(`/broadcasts/${post.id}`); setError(null); await feed.reload(); } catch (err) { setError(err); }
  }

  return (
    <>
      <h1>{t("posts.title")}</h1>
      <div className="cols cols-2">
        <PostForm isAdmin captains={captains.data || []} onPosted={() => { setPage(1); feed.reload(); }} />
        <div className="stack">
          {error && <p className="alert" role="alert">{errorText(t, error)}</p>}
          {feed.data && feed.data.items.length === 0 && <p className="muted">{t("posts.none")}</p>}
          {feed.data && feed.data.items.map((p) => <PostCard key={p.id} post={p} onDelete={remove} />)}
          {feed.data && <Pager page={page} total={feed.data.total} limit={LIMIT} onPage={setPage} />}
        </div>
      </div>
    </>
  );
}
