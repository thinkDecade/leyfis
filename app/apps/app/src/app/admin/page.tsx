"use client";
import { useEffect } from "react";
export default function AdminRedirect() {
  useEffect(() => {
    window.location.replace("https://leyfis-admin.netlify.app");
  }, []);
  return null;
}
