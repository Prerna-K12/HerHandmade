import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { AuthContext } from "../context/AuthContext";
import Login from "../pages/Login";

function renderLogin(login) {
  return render(
    <AuthContext.Provider value={{ user: null, loading: false, login, logout: vi.fn() }}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin/orders" element={<p>ADMIN HOME</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

test("logs in and goes to the admin home", async () => {
  const login = vi.fn().mockResolvedValue({ role: "admin" });
  renderLogin(login);
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: " 9000000001 " } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret-pass" } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));

  await waitFor(() => expect(screen.getByText("ADMIN HOME")).toBeInTheDocument());
  expect(login).toHaveBeenCalledWith("9000000001", "secret-pass"); // phone is trimmed
});

test("shows a translated message for a wrong password", async () => {
  const login = vi.fn().mockRejectedValue({ response: { data: { code: "INVALID_CREDENTIALS" } } });
  renderLogin(login);
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "9000000001" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Wrong phone number or password");
});
