"use client";
export default function SearchError({ reset }: { reset: () => void }) { return <main id="main-content" tabIndex={-1} style={{ padding: "3rem 1.5rem" }}><h1>Search is temporarily unavailable</h1><p>Please try again shortly.</p><button type="button" onClick={reset}>Try again</button></main>; }
