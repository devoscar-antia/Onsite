"use client";

import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useServerInsertedHTML } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#3b82f6" },
    success: { main: "#6ee7b7" },
    error: { main: "#f87171" },
    background: {
      default: "#080c14",
      paper: "#0d1117",
    },
    text: {
      primary: "#f1f5f9",
      secondary: "#64748b",
    },
  },
  typography: {
    fontFamily: "var(--font-sans), DM Sans, sans-serif",
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { margin: 0 } },
    },
  },
});

export function MuiThemeProvider({ children }: { children: ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const c = createCache({ key: "css" });
    c.compat = true;
    const prevInsert = c.insert.bind(c);
    const inserted: string[] = [];
    c.insert = (...args: Parameters<typeof prevInsert>) => {
      const [, serialized] = args;
      if (c.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };
    return {
      cache: c,
      flush: () => {
        const prev = [...inserted];
        inserted.length = 0;
        return prev;
      },
    };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;
    const styles = names.map((n) => cache.inserted[n]).join("");
    return (
      <style
        key={cache.key}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: styles }}
        data-emotion={`${cache.key} ${names.join(" ")}`}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
