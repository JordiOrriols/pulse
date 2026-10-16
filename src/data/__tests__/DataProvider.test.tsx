import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { DataProvider, useData } from "../DataProvider";

const { auth, state } = vi.hoisted(() => {
  const state: { listener?: (event: string, session: unknown) => void } = {};
  return {
    state,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn((listener: typeof state.listener) => {
        state.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    },
  };
});
vi.mock("../supabaseClient", () => ({ supabase: { auth } }));

describe("Pulse authentication", () => {
  it("creates the shared workspace API only while a user is signed in", async () => {
    const { result } = renderHook(() => useData(), { wrapper: DataProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.authEnabled).toBe(true);
    expect(result.current.workspaceApi).toBeNull();
    await act(async () => state.listener?.("SIGNED_IN", { user: { id: "one" } }));
    expect(result.current.workspaceApi?.listWorkspaces).toBeTypeOf("function");
    await act(async () => state.listener?.("SIGNED_OUT", null));
    expect(result.current.workspaceApi).toBeNull();
  });

  it("sends sign-up and recovery emails back to Pulse", async () => {
    const { result } = renderHook(() => useData(), { wrapper: DataProvider });
    const back = `${window.location.origin}${window.location.pathname}?auth_app=pulse`;
    await act(async () => {
      expect(await result.current.signUp("new@example.com", "a-long-password")).toEqual({
        needsConfirmation: true,
      });
      await result.current.requestPasswordReset("member@example.com");
    });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "a-long-password",
      options: { emailRedirectTo: back },
    });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("member@example.com", {
      redirectTo: back,
    });
  });
});

describe("Pulse without Supabase config", () => {
  it("reports auth as unavailable outside the provider", async () => {
    const { result } = renderHook(() => useData());
    expect(result.current.authEnabled).toBe(false);
    await expect(result.current.signIn("a@example.com", "x")).rejects.toThrow(
      "Sign-in is not configured for this build."
    );
  });
});
