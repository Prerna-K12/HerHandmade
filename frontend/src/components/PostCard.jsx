import { useTranslation } from "react-i18next";
import { formatDate, youtubeId } from "../utils";

// One broadcast: text, image or YouTube video. onDelete is optional.
export default function PostCard({ post, onDelete }) {
  const { t, i18n } = useTranslation();
  const videoId = post.type === "video" ? youtubeId(post.videoUrl) : null;

  return (
    <article className="card">
      <div className="row between">
        <strong>{post.author.role === "admin" ? t("role.admin") : post.author.name}</strong>
        <span className="muted small">{formatDate(post.createdAt, i18n.language)}</span>
      </div>
      {post.text && <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{post.text}</p>}
      {post.imageUrl && <img className="post-image" src={post.imageUrl} alt="" loading="lazy" />}
      {videoId && (
        <div className="video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            title={post.text || "Video"}
            loading="lazy"
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {post.type === "video" && !videoId && (
        <p><a href={post.videoUrl} target="_blank" rel="noreferrer">{post.videoUrl}</a></p>
      )}
      {onDelete && (
        <button type="button" className="btn btn-danger btn-small" onClick={() => onDelete(post)}>
          {t("common.delete")}
        </button>
      )}
    </article>
  );
}
