export default function AdminRedirect() {
  if (typeof window !== "undefined") {
    window.location.href = "https://leyfis-admin.netlify.app";
  }
  return null;
}
