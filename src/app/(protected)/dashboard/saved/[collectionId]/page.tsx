import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { getPersonalSavedPage } from "@/features/collections/server/queries";
import { PersonalEventList } from "@/features/participation/components/personal-event-list";
import { CollectionManagement } from "@/features/collections/components/collection-management";
import { SavedNavigation, SavedPagination } from "@/features/collections/components/saved-navigation";
import styles from "@/features/events/components/event-management.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Saved collection", robots: { index: false, follow: false } };
export default async function SavedCollectionPage({ params, searchParams }: { params: Promise<{ collectionId: string }>; searchParams: Promise<{ page?: string }> }) {
  const { collectionId } = await params, { page } = await searchParams;
  const saved = await getPersonalSavedPage(page, collectionId);
  if (!saved?.collection) notFound();
  const collection = saved.collection;
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container><Link href="/dashboard/saved?view=collections" className={styles.back}>Your collections</Link><div className={styles.header}><div><p className={styles.eyebrow}>PRIVATE COLLECTION</p><h1 style={{ overflowWrap: "anywhere" }}>{collection.name}</h1><p>{saved.total} {saved.total === 1 ? "event" : "events"} · Only visible to you</p></div></div><SavedNavigation collections /><CollectionManagement collection={collection} />{saved.rows.length ? <PersonalEventList rows={saved.rows} saved /> : <section className={styles.card}><h2>{saved.total ? "No events on this page." : "No events in this collection yet."}</h2><p>Use Manage collections on a saved event to add it here.</p><Link href="/dashboard/saved">All Saved</Link> · <Link href="/explore">Explore events</Link></section>}<SavedPagination page={saved.page} pages={saved.pages} path={`/dashboard/saved/${collection.id}`} /></Container></main>;
}
