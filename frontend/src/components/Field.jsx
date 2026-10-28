import { cloneElement, useId } from "react";

// A label, one input (the child), an optional hint and an error message, wired together.
export default function Field({ label, error, hint, children }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id, "aria-invalid": error ? "true" : undefined })}
      {hint && <p className="hint">{hint}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
