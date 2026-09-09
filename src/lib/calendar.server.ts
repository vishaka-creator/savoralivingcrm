const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

function calendarHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_CALENDAR_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Calendar is not connected yet");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
    "Content-Type": "application/json",
  };
}

async function calendarRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: { ...calendarHeaders(), ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Google Calendar request failed [${response.status}]: ${body}`);
    throw new Error(`Google Calendar request failed [${response.status}]`);
  }
  return response.status === 204 ? null : response.json();
}

export type CalendarProviderEvent = {
  id?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export async function listPrimaryEvents(timeMin: string, timeMax: string) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  const result = (await calendarRequest(`/calendars/primary/events?${params.toString()}`)) as {
    items?: CalendarProviderEvent[];
  };
  return result.items ?? [];
}

export async function createPrimaryEvent(event: {
  title: string;
  notes?: string | null;
  start_time: string;
  end_time?: string | null;
}) {
  return (await calendarRequest("/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify({
      summary: event.title,
      description: event.notes ?? undefined,
      start: { dateTime: event.start_time },
      end: { dateTime: event.end_time ?? event.start_time },
    }),
  })) as CalendarProviderEvent;
}

export async function updatePrimaryEvent(
  eventId: string,
  event: { title: string; notes?: string | null; start_time: string; end_time?: string | null },
) {
  return (await calendarRequest(`/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: "PUT",
    body: JSON.stringify({
      summary: event.title,
      description: event.notes ?? undefined,
      start: { dateTime: event.start_time },
      end: { dateTime: event.end_time ?? event.start_time },
    }),
  })) as CalendarProviderEvent;
}

export async function deletePrimaryEvent(eventId: string) {
  await calendarRequest(`/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });
}