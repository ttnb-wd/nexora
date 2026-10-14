import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PersonalEventList } from "@/features/participation/components/personal-event-list";
import { getPersonalCollections, getPersonalSavedPage } from "@/features/collections/server/queries";
import { CollectionManagement } from "@/features/collections/components/collection-management";
import { SavedNavigation, SavedPagination } from "@/features/collections/components/saved-navigation";
import collectionStyles from "@/features/collections/components/collections.module.css";
import styles from "@/features/events/components/event-management.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Saved events", robots: { index: false, follow: false } };
export default async function PersonalEventsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams, collectionsView = params.view === "collections";
  const collections = collectionsView ? await getPersonalCollections() : [];
  const saved = collectionsView ? null : await getPersonalSavedPage(params.page);
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container>
    <Link href="/dashboard" className={styles.back}>Dashboard</Link><div className={styles.header}><div><p className={styles.eyebrow}>YOUR NEXORA</p><h1>Your saved events.</h1><p className={styles.intro}>All your saved events, with private collections to keep them organized.</p></div><Link href="/dashboard/joined">Joined events</Link></div>
    <SavedNavigation collections={collectionsView} />
    {collectionsView ? <><CollectionManagement count={collections.length} />{collections.length ? <div className={collectionStyles.grid}>{collections.map(collection => <section className={collectionStyles.collection} key={collection.id}><h2><Link href={`/dashboard/saved/${collection.id}`}>{collection.name}</Link></h2><p>{collection.count} {collection.count === 1 ? "event" : "events"}</p><p className={collectionStyles.hint}>Private collection</p></section>)}</div> : <section className={styles.card}><h2>No collections yet.</h2><p>Create a collection to organize saved events.</p><Link href="/explore">Explore events</Link></section>}</>
      : saved && <><p className={collectionStyles.hint}>{saved.total} saved {saved.total === 1 ? "event" : "events"}</p>{saved.total === 0 ? <section className={styles.card}><h2>You haven’t saved any events yet.</h2><p>Save an event to keep it here, with or without a collection.</p><Link href="/explore">Explore events</Link></section> : saved.rows.length ? <PersonalEventList rows={saved.rows} saved /> : <p>No saved events on this page. <Link href="/dashboard/saved">Return to All Saved</Link></p>}<SavedPagination page={saved.page} pages={saved.pages} path="/dashboard/saved" /></>}
  </Container></main>;
}
