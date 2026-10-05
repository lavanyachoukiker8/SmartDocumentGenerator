"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "./types";

const ROLE_STORAGE_KEY = "clubdocs.user.role";

export function useUserRole() {
  const [role, setRoleState] = useState<UserRole>("admin");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(ROLE_STORAGE_KEY) as UserRole | null;
      if (saved && (saved === "admin" || saved === "member" || saved === "faculty")) {
        setRoleState(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, newRole);
      window.dispatchEvent(new Event("clubdocs:role-change"));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const handler = () => {
      try {
        const saved = localStorage.getItem(ROLE_STORAGE_KEY) as UserRole | null;
        if (saved && (saved === "admin" || saved === "member" || saved === "faculty")) {
          setRoleState(saved);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("clubdocs:role-change", handler);
    return () => window.removeEventListener("clubdocs:role-change", handler);
  }, []);

  return { role, setRole, mounted };
}
