const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function submitTextRequest(data: {
  text: string;
  room_number: string;
  org_id: string;
  lang?: string;
}) {
  return apiRequest<{ request_id: string }>("/api/requests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function submitVoiceRequest(data: {
  audio: Blob;
  room_number: string;
  org_id: string;
}) {
  const formData = new FormData();
  formData.append("audio", data.audio, "recording.webm");
  formData.append("room_number", data.room_number);
  formData.append("org_id", data.org_id);

  const res = await fetch(`${API_BASE}/api/requests/voice`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<{ request_id: string }>;
}
