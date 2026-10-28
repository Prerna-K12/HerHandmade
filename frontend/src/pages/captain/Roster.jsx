import { useState } from "react";
import { useTranslation } from "react-i18next";
import api, { errorText } from "../../api";
import usePolling from "../../hooks/usePolling";
import Field from "../../components/Field";

export default function Roster() {
  const { t } = useTranslation();
  const { data: group, error, loading, reload } = usePolling(() => api.get("/groups/me").then((r) => r.data.group), []);
  const [name, setName] = useState("");
  const [actionError, setActionError] = useState(null);

  if (loading) return <p className="center muted">{t("common.loading")}</p>;
  if (error || !group) return <p className="alert" role="alert">{errorText(t, error)}</p>;

  const link = `${window.location.origin}/g/${group.accessCode}`;

  async function run(fn) {
    try { await fn(); setActionError(null); await reload(); } catch (err) { setActionError(err); }
  }

  const addMember = (e) => { e.preventDefault(); if (name.trim()) run(() => api.post("/groups/me/members", { name: name.trim() }).then(() => setName(""))); };
  const removeMember = (m) => window.confirm(t("common.confirm")) && run(() => api.delete(`/groups/me/members/${m.id}`));
  const newLink = () => window.confirm(t("captain.newLinkConfirm")) && run(() => api.post("/groups/me/access-code"));
  const copy = () => navigator.clipboard && navigator.clipboard.writeText(link).then(() => window.alert(t("common.copied")));

  return (
    <>
      <h1>{group.name}</h1>
      <p className="muted">{group.village}, {group.district}</p>

      <div className="stack">
        <section className="card stack">
          <h2>{t("captain.groupLink")}</h2>
          <p className="muted small" style={{ margin: 0 }}>{t("captain.groupLinkHelp")}</p>
          <div className="linkbox">{link}</div>
          <div className="row">
            <button type="button" className="btn grow" onClick={copy}>{t("common.copyLink")}</button>
            <button type="button" className="btn btn-outline grow" onClick={newLink}>{t("captain.newLink")}</button>
          </div>
        </section>

        <section className="card stack">
          <h2>{t("captain.members")} ({group.members.length})</h2>
          <form className="row" onSubmit={addMember}>
            <div className="grow"><Field label={t("captain.memberName")}><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field></div>
            <button type="submit" className="btn" style={{ alignSelf: "flex-end" }}>{t("captain.addMember")}</button>
          </form>
          {group.members.length === 0 && <p className="muted">{t("captain.noMembers")}</p>}
          {group.members.map((m) => (
            <div key={m.id} className="row between">
              <span>{m.name}</span>
              <button type="button" className="btn btn-danger btn-small" aria-label={`${t("common.delete")} ${m.name}`} onClick={() => removeMember(m)}>{t("common.delete")}</button>
            </div>
          ))}
        </section>

        {actionError && <p className="alert" role="alert">{errorText(t, actionError)}</p>}
      </div>
    </>
  );
}
