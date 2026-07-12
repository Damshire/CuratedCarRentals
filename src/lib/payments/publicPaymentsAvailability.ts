const PUBLIC_PAYMENTS_UNAVAILABLE_MESSAGE =
  "Online payments are temporarily unavailable. Please contact support or choose pay on pickup.";

export function getPublicPaymentsUnavailableMessage() {
  return PUBLIC_PAYMENTS_UNAVAILABLE_MESSAGE;
}

export function arePublicOnlinePaymentsEnabled() {
  const configured = process.env.PUBLIC_WIPAY_ENABLED?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return process.env.NODE_ENV !== "production";
}
