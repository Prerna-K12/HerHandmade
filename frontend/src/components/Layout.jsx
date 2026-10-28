import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import LanguageSwitch from "./LanguageSwitch";
import Icon from "./Icons";

// Top bar on every page. `nav` (admin and captain areas) becomes a bottom bar on phones.
export default function Layout({ nav = [], wide = false, children }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div className={nav.length ? "has-nav" : ""}>
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          {t("common.appName")}
        </Link>
        {nav.length > 0 && (
          <nav className="nav" aria-label="Main">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                <Icon name={item.icon} />
                <span>{t(`nav.${item.icon}`)}</span>
              </NavLink>
            ))}
          </nav>
        )}
        <div className="tools">
          <LanguageSwitch />
          {user && (
            <button type="button" className="btn btn-quiet" onClick={logout}>
              {t("common.logout")}
            </button>
          )}
        </div>
      </header>
      <main className={wide ? "page wide" : "page"}>{children}</main>
    </div>
  );
}
