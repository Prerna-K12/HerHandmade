import { useTranslation } from "react-i18next";

export default function Pager({ page, total, limit, onPage }) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="row between">
      <button type="button" className="btn btn-outline btn-small" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t("common.previous")}
      </button>
      <span className="muted small">{t("common.page", { page, pages })}</span>
      <button type="button" className="btn btn-outline btn-small" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {t("common.next")}
      </button>
    </div>
  );
}
