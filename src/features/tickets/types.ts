export type TicketDisplay = {
  title: string; slug: string; name: string; status: string; date: string;
  location: string; type: string; token: string; qr: string;
};
export type TicketState = { ok?: boolean; message?: string; ticket?: TicketDisplay };
export type ScanState = { ok?: boolean; message?: string; name?: string };
