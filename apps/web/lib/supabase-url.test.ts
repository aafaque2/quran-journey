import { describe, expect, it } from "vitest";
import { supabaseProjectUrl } from "./supabase-url";

describe("supabaseProjectUrl", () => {
  it.each([
    ["https://abc.supabase.co", "https://abc.supabase.co"],
    ["https://abc.supabase.co/", "https://abc.supabase.co"],
    ["https://abc.supabase.co/rest/v1", "https://abc.supabase.co"],
    ["https://abc.supabase.co/rest/v1/", "https://abc.supabase.co"],
    ["https://abc.supabase.co/rest/v1/reports", "https://abc.supabase.co"],
    ["  https://abc.supabase.co/rest/v1/\n", "https://abc.supabase.co"],
    // A self-hosted Supabase behind a path prefix keeps its prefix.
    ["https://db.example.org/supabase/", "https://db.example.org/supabase"],
  ])("%j → %s", (input, expected) => {
    expect(supabaseProjectUrl(input)).toBe(expected);
  });
});
