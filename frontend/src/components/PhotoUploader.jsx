import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorText } from "../api";
import { compressImage } from "../utils";

// A button that opens the camera or gallery, shrinks the photos, then calls onUpload(files).
export default function PhotoUploader({ label, onUpload, multiple = true, max = 5 }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onChange(e) {
    const files = [...e.target.files].slice(0, max);
    e.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const small = await Promise.all(files.map((f) => compressImage(f)));
      await onUpload(small);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <label className="btn btn-outline" aria-disabled={busy}>
        {busy ? t("common.uploading") : label}
        <input type="file" accept="image/*" multiple={multiple} hidden onChange={onChange} disabled={busy} />
      </label>
      {error && <p className="alert" role="alert">{error}</p>}
    </div>
  );
}
