import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/server/session";
import { getAccountSettings } from "@/features/account/server/service";
import { AccountSettingsView } from "@/features/account/components/account-settings";
import styles from "@/features/account/components/settings.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account settings", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function Page() {
  // Self-service security remains available to authenticated unverified users.
  if (!await getCurrentUser()) redirect("/sign-in?returnTo=%2Fdashboard%2Fsettings");
  const account = await getAccountSettings(await headers()).catch(() => null);
  return <main id="main-content" tabIndex={-1} className={styles.page}><div className={styles.inner}><Link href="/dashboard">Back to dashboard</Link><h1>Account settings</h1><p>Manage your profile, security and preferences.</p>{account ? <AccountSettingsView account={account} timezones={Intl.supportedValuesOf("timeZone")} /> : <p role="alert">Unable to load your account settings. Please refresh or sign in again.</p>}</div></main>;
}
