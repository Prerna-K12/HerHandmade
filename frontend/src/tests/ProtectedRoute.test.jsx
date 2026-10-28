import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";

function renderAt(user, loading = false) {
  return render(
    <AuthContext.Provider value={{ user, loading }}>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/login" element={<p>LOGIN PAGE</p>} />
          <Route path="/" element={<p>HOME PAGE</p>} />
          <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><p>SECRET ADMIN PAGE</p></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

test("a visitor is sent to the login page", () => {
  renderAt(null);
  expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
});

test("the right role sees the page", () => {
  renderAt({ role: "admin" });
  expect(screen.getByText("SECRET ADMIN PAGE")).toBeInTheDocument();
});

test("the wrong role is sent home", () => {
  renderAt({ role: "leader" });
  expect(screen.getByText("HOME PAGE")).toBeInTheDocument();
});

test("nothing is decided while the session is loading", () => {
  renderAt(null, true);
  expect(screen.getByText("Loading…")).toBeInTheDocument();
  expect(screen.queryByText("LOGIN PAGE")).not.toBeInTheDocument();
});
