"use client";

import { createContext, useContext } from "react";

type AccessValue = {
  canWrite: boolean;
  listOnly: boolean;
};

const AccessContext = createContext<AccessValue>({ canWrite: true, listOnly: false });

export function AccessProvider({
  canWrite,
  listOnly,
  children,
}: AccessValue & { children: React.ReactNode }) {
  return (
    <AccessContext.Provider value={{ canWrite, listOnly }}>{children}</AccessContext.Provider>
  );
}

export function useAccess(): AccessValue {
  return useContext(AccessContext);
}
