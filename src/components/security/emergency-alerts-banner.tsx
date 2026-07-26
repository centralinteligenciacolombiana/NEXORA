"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Siren, Volume2, VolumeX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolveEmergencyAlertAction } from "@/lib/actions/security";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SecurityAlertView = {
  id: string;
  unit_id: string;
  status: string;
  alert_type: string;
  created_at: string;
  unitLabel: string;
  residentName: string;
};

interface EmergencyAlertsBannerProps {
  complexId: string;
  unitIds: string[];
  initialAlerts: SecurityAlertView[];
}

function playAlertTone() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    window.setTimeout(() => {
      osc.stop();
      void ctx.close();
    }, 350);
  } catch {
    // silenciamiento en navegadores restrictivos
  }
}

export function EmergencyAlertsBanner({
  complexId,
  unitIds,
  initialAlerts,
}: EmergencyAlertsBannerProps) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [soundOn, setSoundOn] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const knownIds = useRef(new Set(initialAlerts.map((a) => a.id)));
  const unitIdSet = useRef(new Set(unitIds));

  useEffect(() => {
    unitIdSet.current = new Set(unitIds);
  }, [unitIds]);

  useEffect(() => {
    setAlerts(initialAlerts);
    knownIds.current = new Set(initialAlerts.map((a) => a.id));
  }, [initialAlerts]);

  const enrichAlert = useCallback(
    async (row: {
      id: string;
      unit_id: string;
      status: string;
      alert_type: string;
      created_at: string;
      triggered_by: string;
    }): Promise<SecurityAlertView | null> => {
      if (!unitIdSet.current.has(row.unit_id)) return null;

      const supabase = createClient();
      const [{ data: unit }, { data: profile }] = await Promise.all([
        supabase
          .from("units")
          .select("number, tower, complex_id")
          .eq("id", row.unit_id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", row.triggered_by)
          .maybeSingle(),
      ]);

      if (unit?.complex_id !== complexId) return null;

      return {
        id: row.id,
        unit_id: row.unit_id,
        status: row.status,
        alert_type: row.alert_type,
        created_at: row.created_at,
        unitLabel: [unit.tower, `Apto ${unit.number}`]
          .filter(Boolean)
          .join(" · "),
        residentName: profile?.full_name?.trim() || "Residente",
      };
    },
    [complexId],
  );

  useEffect(() => {
    if (unitIds.length === 0) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`emergency-alerts-${complexId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "emergency_alerts",
        },
        (payload) => {
          void (async () => {
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as { id?: string };
              if (oldRow.id) {
                setAlerts((prev) => prev.filter((a) => a.id !== oldRow.id));
                knownIds.current.delete(oldRow.id);
              }
              return;
            }

            const row = payload.new as {
              id: string;
              unit_id: string;
              status: string;
              alert_type: string;
              created_at: string;
              triggered_by: string;
            };

            if (!unitIdSet.current.has(row.unit_id)) return;

            if (row.status !== "ACTIVE") {
              setAlerts((prev) => prev.filter((a) => a.id !== row.id));
              knownIds.current.delete(row.id);
              return;
            }

            const enriched = await enrichAlert(row);
            if (!enriched) return;

            setAlerts((prev) => {
              const without = prev.filter((a) => a.id !== enriched.id);
              return [enriched, ...without];
            });

            if (!knownIds.current.has(row.id)) {
              knownIds.current.add(row.id);
              if (soundOn) playAlertTone();
            }
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [complexId, unitIds, enrichAlert, soundOn]);

  function handleResolve(alertId: string) {
    setResolvingId(alertId);
    startTransition(async () => {
      const result = await resolveEmergencyAlertAction(alertId);
      if (result.success) {
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
        knownIds.current.delete(alertId);
      }
      setResolvingId(null);
    });
  }

  if (alerts.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-[var(--emerald-soft)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
          <CheckCircle2 className="size-5 text-[var(--emerald)]" aria-hidden />
          Sin alertas activas
        </div>
        <button
          type="button"
          onClick={() => setSoundOn((v) => !v)}
          className="rounded-lg p-2 text-emerald-800 hover:bg-white/60"
          aria-label={soundOn ? "Silenciar alertas" : "Activar sonido"}
        >
          {soundOn ? (
            <Volume2 className="size-5" aria-hidden />
          ) : (
            <VolumeX className="size-5" aria-hidden />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "animate-pulse rounded-2xl border-2 border-red-500 bg-[var(--danger-soft)] p-4 shadow-lg sm:p-5",
          )}
          role="alert"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                <Siren className="size-6" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-red-700">
                  Emergencia activa · {alert.alert_type}
                </p>
                <p className="mt-1 text-lg font-bold text-red-950 sm:text-xl">
                  {alert.unitLabel}
                </p>
                <p className="text-sm text-red-900">
                  <AlertTriangle className="mr-1 inline size-4" aria-hidden />
                  {alert.residentName}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="lg"
              className="min-h-12 w-full bg-red-700 hover:bg-red-800 focus:ring-red-600 sm:w-auto"
              disabled={pending && resolvingId === alert.id}
              onClick={() => {
                if (
                  window.confirm(
                    `¿Marcar como resuelta la alerta de ${alert.unitLabel}?`,
                  )
                ) {
                  handleResolve(alert.id);
                }
              }}
            >
              {pending && resolvingId === alert.id
                ? "Resolviendo…"
                : "Marcar RESUELTA"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
