import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import PlaceOrder from "../pages/public/PlaceOrder";

vi.mock("../api", async (original) => ({ ...(await original()), default: { post: vi.fn(), get: vi.fn() } }));

const renderPage = () =>
  render(
    <AuthContext.Provider value={{ user: null, loading: false }}>
      <MemoryRouter><PlaceOrder /></MemoryRouter>
    </AuthContext.Provider>
  );

const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

test("an empty form shows field errors and sends nothing", () => {
  renderPage();
  fireEvent.click(screen.getByRole("button", { name: "Send order" }));
  expect(screen.getAllByText("Please fill this in")).toHaveLength(3);
  expect(screen.getByText("Enter a number of 1 or more")).toBeInTheDocument();
  expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test("a valid order is sent as numbers and shows the reference", async () => {
  api.post.mockResolvedValue({ data: { orderRef: "HH-7QK2MD", trackingUrl: "http://x/track/abc123" } });
  renderPage();
  fill("Business name", "Bloom & Co");
  fill("Location", "Bengaluru");
  fill("What do you need?", "Handmade rakhi");
  fill("Quantity", "500");
  fill("Delivery date", "2099-01-01");
  fill("Email", "orders@bloomco.example");
  fireEvent.click(screen.getByRole("button", { name: "Send order" }));

  await waitFor(() => expect(screen.getByText("HH-7QK2MD")).toBeInTheDocument());
  expect(api.post).toHaveBeenCalledWith("/public/orders", expect.objectContaining({ quantity: 500, item: "Handmade rakhi", website: "" }));
  expect(screen.getByRole("link", { name: "Open tracking page" })).toHaveAttribute("href", "/track/abc123");
});

test("a server error is shown in the user's language", async () => {
  api.post.mockRejectedValue({ response: { data: { code: "TOO_MANY_REQUESTS" } } });
  renderPage();
  fill("Business name", "A"); fill("Location", "B"); fill("What do you need?", "C");
  fill("Quantity", "5"); fill("Delivery date", "2099-01-01"); fill("Email", "a@b.co");
  fireEvent.click(screen.getByRole("button", { name: "Send order" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Too many tries");
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("a retry after a failed attempt sends the SAME idempotency key", async () => {
  api.post.mockReset();
  api.post
    .mockRejectedValueOnce({ response: undefined }) // no connection
    .mockResolvedValueOnce({ data: { orderRef: "HH-AAAAAA", trackingUrl: "http://x/track/abc" } });
  renderPage();
  fill("Business name", "A"); fill("Location", "B"); fill("What do you need?", "C");
  fill("Quantity", "5"); fill("Delivery date", "2099-01-01"); fill("Email", "a@b.co");

  fireEvent.click(screen.getByRole("button", { name: "Send order" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Send order" }));
  await screen.findByText("HH-AAAAAA");

  const [first, second] = api.post.mock.calls.map((call) => call[1].idempotencyKey);
  expect(first).toMatch(UUID);
  expect(second).toBe(first);
  expect(sessionStorage.getItem("orderKey")).toBeNull();
});