import { useState } from "react";
import { useTranslation } from "react-i18next";
import api, { errorText } from "../../api";
import { useAuth } from "../../context/AuthContext";
import usePolling from "../../hooks/usePolling";
import PostForm from "../../components/PostForm";
import PostCard from "../../components/PostCard";
import Pager from "../../components/Pager";

const LIMIT = 10;

export default function CaptainFeed() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const { data, reload } = usePolling(() => api.get("/broadcasts", { params: { page, limit: LIMIT } }).then((r) => r.data), [page], 30000);

  async function remove(post) {
    if (!window.confirm(t("common.confirm"))) return;
    try { await api.delete(`/broadcasts/${post.id}`); setError(null); await reload(); } catch (err) { setError(err); }
  }

  return (
    <>
      <h1>{t("nav.feed")}</h1>
      <div className="stack">
        <PostForm isAdmin={false} onPosted={() => { setPage(1); reload(); }} />
        {error && <p className="alert" role="alert">{errorText(t, error)}</p>}
        {data && data.items.length === 0 && <p className="muted">{t("posts.none")}</p>}
        {data && data.items.map((p) => (
          <PostCard key={p.id} post={p} onDelete={user && p.author.id === user.id ? remove : undefined} />
        ))}
        {data && <Pager page={page} total={data.total} limit={LIMIT} onPage={setPage} />}
      </div>
    </>
  );
}
