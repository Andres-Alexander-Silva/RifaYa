import { useEffect, useRef } from "react";

export interface TicketPatch {
  id: string;
  number: number;
  status: string;
}

export function useRaffleSocket(
  raffleId: string | undefined,
  onUpdate: (patches: TicketPatch[]) => void,
) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!raffleId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/api/v1/ws/raffle/${raffleId}`,
    );

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "tickets_updated" && Array.isArray(msg.tickets)) {
          callbackRef.current(msg.tickets);
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => ws.close();
  }, [raffleId]);
}
