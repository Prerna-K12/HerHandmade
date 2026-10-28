import { createContext, useContext, useEffect, useState } from "react";
import api from "../api";

export const AuthContext = createContext({ user: null, loading: false });

export const homeFor = (user) => (user.role === "admin" ? "/admin/orders" : "/captain");

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, ask the server who we are (the login cookie is sent automatically).
  useEffect(() => {
    api
      .get("/api/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(phone, password) {
    const res = await api.post("/api/auth/login", { phone, password });
    setUser(res.data.user);
    return res.data.user;
  }

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
