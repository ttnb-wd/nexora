import Link from "next/link";
import { analyticsRanges, type AnalyticsRange, type StatusCounts } from "../metrics";
import styles from "./analytics.module.css";
export function RangeLinks({ range, path, label }: { range: AnalyticsRange; path: string; label: string }) {
  return <nav aria-label={label} className={styles.ranges}>{analyticsRanges.map(value => <Link key={value} href={`${path}?range=${value}`} aria-current={range === value ? "page" : undefined}>{value === "all" ? "All time" : `Last ${value} days`}</Link>)}</nav>;
}
export function Kpis({ items }: { items: { label: string; value: string | number; note?: string }[] }) {
  return <dl className={styles.kpis}>{items.map(item => <div className={styles.kpi} key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd>{item.note && <small>{item.note}</small>}</div>)}</dl>;
}
export function StatusBreakdown({ counts }: { counts: StatusCounts }) {
  const statuses = (["REGISTERED","ATTENDED","CANCELLED","WAITLISTED","NO_SHOW"] as const).filter(status => ["REGISTERED","ATTENDED","CANCELLED"].includes(status) || counts[status] > 0);
  return <section className={styles.section}><h2>Registration status breakdown</h2><div className={styles.tableWrap}><table className={styles.table}><caption>Current status of each first registration record</caption><thead><tr><th scope="col">Status</th><th scope="col">Records</th></tr></thead><tbody>{statuses.map(status => <tr key={status}><th scope="row">{status.replaceAll("_"," ")}</th><td>{counts[status]}</td></tr>)}</tbody></table></div></section>;
}
export function Freshness({ at }: { at: Date }) {
  return <p className={styles.note}>Read from live records at <time dateTime={at.toISOString()}>{new Intl.DateTimeFormat("en",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Yangon"}).format(at)} (Asia/Yangon)</time>. Reload to see the latest changes.</p>;
}
