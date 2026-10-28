import { useState } from "react";
import { useTranslation } from "react-i18next";
import api, { errorText } from "../api";
import { compressImage } from "../utils";
import Field from "./Field";

// New post. Admin chooses all groups or one captain. A captain always posts to her own group.
export default function PostForm({ isAdmin, captains = [], onPosted }) {
  const { t } = useTranslation();
  const [audience, setAudience] = useState(isAdmin ? "all_groups" : "own_group");
  const [target, setTarget] = useState("");
  const [type, setType] = useState("text");
  const [text, setText] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (type === "text" && !text.trim()) return setError(t("posts.needText"));
    if (type === "video" && !videoUrl.trim()) return setError(t("posts.needVideo"));
    if (type === "image" && !file) return setError(t("posts.needImage"));
    if (audience === "one_leader" && !target) return setError(t("posts.needCaptain"));

    setBusy(true);
    try {
      const fields = { audience, type, text: text.trim() };
      if (audience === "one_leader") fields.targetGroupId = target;
      if (type === "video") fields.videoUrl = videoUrl.trim();

      if (type === "image") {
        const form = new FormData();
        Object.entries(fields).forEach(([k, v]) => v !== "" && form.append(k, v));
        form.append("image", await compressImage(file));
        await api.post("/broadcasts", form);
      } else {
        await api.post("/broadcasts", fields);
      }
      setText(""); setVideoUrl(""); setFile(null); setType("text");
      onPosted();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit} noValidate>
      <h2>{t("posts.new")}</h2>

      {isAdmin && (
        <Field label={t("posts.audience")}>
          <select value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="all_groups">{t("posts.allGroups")}</option>
            <option value="one_leader">{t("posts.oneCaptain")}</option>
          </select>
        </Field>
      )}
      {isAdmin && audience === "one_leader" && (
        <Field label={t("posts.chooseCaptain")}>
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">-</option>
            {captains.filter((c) => c.active).map((c) => (
              <option key={c.group.id} value={c.group.id}>{c.name} ({c.group.village})</option>
            ))}
          </select>
        </Field>
      )}
      {!isAdmin && <p className="muted small">{t("posts.ownGroupNote")}</p>}

      <div className="seg" role="group" aria-label={t("posts.type")}>
        {["text", "image", "video"].map((k) => (
          <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)}>
            {t(`posts.${k}`)}
          </button>
        ))}
      </div>

      <Field label={t("posts.message")}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
      </Field>
      {type === "video" && (
        <Field label={t("posts.videoUrl")} hint={t("posts.videoHelp")}>
          <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtu.be/..." />
        </Field>
      )}
      {type === "image" && (
        <Field label={t("posts.choosePhoto")}>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
        </Field>
      )}

      {error && <p className="alert" role="alert">{error}</p>}
      <button type="submit" className="btn" disabled={busy}>{busy ? t("common.uploading") : t("posts.post")}</button>
    </form>
  );
}
