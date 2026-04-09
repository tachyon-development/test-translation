import { redirect } from "next/navigation";

interface RoomRouteParams {
  params: Promise<{ orgSlug: string; roomNumber: string }>;
}

export default async function RoomRedirectPage({ params }: RoomRouteParams) {
  const { orgSlug, roomNumber } = await params;
  redirect(`/?room=${encodeURIComponent(roomNumber)}&org=${encodeURIComponent(orgSlug)}`);
}
