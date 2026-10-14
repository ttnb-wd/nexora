import Link from "next/link";
import styles from "./collections.module.css";
export function SavedNavigation({ collections = false }: { collections?: boolean }) {
  return <nav className={styles.tabs} aria-label="Saved events"><Link href="/dashboard/saved" aria-current={!collections ? "page" : undefined}>All Saved</Link><Link href="/dashboard/saved?view=collections" aria-current={collections ? "page" : undefined}>Collections</Link></nav>;
}
export function SavedPagination({ page, pages, path }: { page: number; pages: number; path: string }) {
  return pages > 1 ? <nav className={styles.pagination} aria-label="Saved event pages">{page > 1 && <Link href={`${path}?page=${page - 1}`}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={`${path}?page=${page + 1}`}>Next</Link>}</nav> : null;
}
