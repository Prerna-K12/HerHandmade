import { useState } from "react";
import { useTranslation } from "react-i18next";
import api, { errorText } from "../../api";
import usePolling from "../../hooks/usePolling";
import Field from "../../components/Field";

const BLANK = { name: "", phone: "", password: "", groupName: "", village: "", district: "" };

export default function Captains() {
  const { t } = useTranslation();
  const [error, setError] = useState(null);
  const captains = usePolling(() => api.get("/captains").then((r) => r.data.captains), []);
  const skills = usePolling(() => api.get("/skills").then((r) => r.data.skills), []);

  async function run(fn) {
    try { await fn(); setError(null); await Promise.all([captains.reload(), skills.reload()]); } catch (err) { setError(err); }
  }

  const resetPassword = (c) => {
    const password = window.prompt(t("captains.newPassword", { name: c.name }));
    if (password) run(() => api.put(`/captains/${c.id}/password`, { password }).then(() => window.alert(t("common.saved"))));
  };
  const deactivate = (c) => window.confirm(t("captains.confirmDeactivate", { name: c.name })) && run(() => api.delete(`/captains/${c.id}`));

  return (
    <>
      <h1>{t("nav.captains")}</h1>
      {error && <p className="alert" role="alert">{errorText(t, error)}</p>}

      <div className="cols cols-2" style={{ marginBottom: 16 }}>
        <NewCaptain onDone={captains.reload} />
        <NewSkill onDone={skills.reload} />
      </div>

      {captains.loading && <p className="muted">{t("common.loading")}</p>}
      <div className="stack">
        {captains.data && captains.data.map((c) => (
          <article key={c.id} className="card stack" style={c.active ? undefined : { opacity: 0.65 }}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>{c.group.name}</h3>
              <span className={`badge ${c.active ? "badge-done" : "badge-declined"}`}>{c.active ? t("captains.active") : t("captains.inactive")}</span>
            </div>
            <p style={{ margin: 0 }}>
              {c.name} · <a href={`tel:${c.phone}`}>{c.phone}</a><br />
              <span className="muted small">{c.group.village}, {c.group.district} · {t("captains.openTasks", { n: c.group.openAssignments })}</span>
            </p>
            {c.active && skills.data && <SkillsEditor captain={c} skills={skills.data} onSaved={captains.reload} />}
            {c.active && (
              <div className="row">
                <button type="button" className="btn btn-outline btn-small" onClick={() => resetPassword(c)}>{t("captains.resetPassword")}</button>
                <button type="button" className="btn btn-danger btn-small" onClick={() => deactivate(c)}>{t("captains.deactivate")}</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

function NewCaptain({ onDone }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/captains", {
        name: form.name, phone: form.phone, password: form.password,
        group: { name: form.groupName, village: form.village, district: form.district },
      });
      setForm(BLANK);
      setError(null);
      await onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="card">
      <summary><strong>{t("captains.add")}</strong></summary>
      <form className="stack" onSubmit={submit} style={{ marginTop: 12 }}>
        <Field label={t("common.name")}><input value={form.name} onChange={set("name")} required /></Field>
        <Field label={t("common.phone")}><input type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} required /></Field>
        <Field label={t("common.password")} hint={t("captains.passwordHint")}><input type="text" value={form.password} onChange={set("password")} minLength={8} required /></Field>
        <Field label={t("captains.groupName")}><input value={form.groupName} onChange={set("groupName")} required /></Field>
        <Field label={t("common.village")}><input value={form.village} onChange={set("village")} required /></Field>
        <Field label={t("common.district")}><input value={form.district} onChange={set("district")} required /></Field>
        {error && <p className="alert" role="alert">{errorText(t, error)}</p>}
        <button type="submit" className="btn" disabled={busy}>{t("captains.create")}</button>
      </form>
    </details>
  );
}

function NewSkill({ onDone }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("");
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post("/skills", { name, aliases: aliases.split(",").map((s) => s.trim()).filter(Boolean) });
      setName(""); setAliases(""); setError(null);
      await onDone();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <details className="card">
      <summary><strong>{t("captains.newSkill")}</strong></summary>
      <form className="stack" onSubmit={submit} style={{ marginTop: 12 }}>
        <Field label={t("captains.skillName")}><input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label={t("captains.aliases")} hint="rakhee, राखी"><input value={aliases} onChange={(e) => setAliases(e.target.value)} /></Field>
        {error && <p className="alert" role="alert">{errorText(t, error)}</p>}
        <button type="submit" className="btn">{t("captains.addSkill")}</button>
      </form>
    </details>
  );
}

// Rate this group for each skill (0 = not rated). Only the admin can do this.
function SkillsEditor({ captain, skills, onSaved }) {
  const { t } = useTranslation();
  const initial = Object.fromEntries(captain.group.skills.map((s) => [s.skillId, { rating: s.rating, verified: s.verified }]));
  const [values, setValues] = useState(initial);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const update = (id, patch) => { setSaved(false); setValues({ ...values, [id]: { rating: 0, verified: false, ...values[id], ...patch } }); };

  async function save() {
    const list = Object.entries(values)
      .filter(([, v]) => v.rating > 0)
      .map(([skillId, v]) => ({ skillId: Number(skillId), rating: v.rating, verified: !!v.verified }));
    try {
      await api.put(`/groups/${captain.group.id}/skills`, { skills: list });
      setError(null); setSaved(true);
      await onSaved();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <details>
      <summary><strong>{t("captains.skills")}</strong> <span className="muted small">({captain.group.skills.length})</span></summary>
      <div className="stack" style={{ marginTop: 10 }}>
        {skills.map((s) => {
          const v = values[s.id] || { rating: 0, verified: false };
          return (
            <div key={s.id} className="row between">
              <span className="grow">{s.name}</span>
              <select className="select" style={{ width: 110 }} aria-label={`${s.name} ${t("captains.rating")}`} value={v.rating} onChange={(e) => update(s.id, { rating: Number(e.target.value) })}>
                <option value={0}>{t("captains.notRated")}</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
              </select>
              <label className="row small" style={{ gap: 4 }}>
                <input type="checkbox" checked={!!v.verified} disabled={v.rating === 0} onChange={(e) => update(s.id, { verified: e.target.checked })} />
                {t("captains.verified")}
              </label>
            </div>
          );
        })}
        {error && <p className="alert" role="alert">{errorText(t, error)}</p>}
        {saved && <p className="alert alert-ok">{t("common.saved")}</p>}
        <button type="button" className="btn btn-small" onClick={save}>{t("captains.saveSkills")}</button>
      </div>
    </details>
  );
}
