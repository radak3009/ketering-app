import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WeeklySchedule {
  id?: string;
  dayOfWeek: number;
  enabled: boolean;
  openTime: string;
  closeTime: string;
}

export interface ScheduleException {
  id: string;
  date: string;
  closedAllDay: boolean;
  openTime: string | null;
  closeTime: string | null;
  note: string | null;
}

const DAY_NAMES = [
  "Nedelja",
  "Ponedeljak",
  "Utorak",
  "Sreda",
  "Četvrtak",
  "Petak",
  "Subota",
];

export function useKitchenSchedule() {
  const { toast } = useToast();
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchWeeklySchedule = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("kitchen_schedule_weekly")
        .select("*")
        .is("company_id", null)
        .order("day_of_week");

      if (error) throw error;

      // Map database format to frontend format
      const mapped: WeeklySchedule[] = (data || []).map((row) => ({
        id: row.id,
        dayOfWeek: row.day_of_week,
        enabled: row.enabled,
        openTime: row.open_time?.substring(0, 5) || "06:00",
        closeTime: row.close_time?.substring(0, 5) || "22:00",
      }));

      // Ensure all 7 days exist
      const fullSchedule: WeeklySchedule[] = [];
      for (let i = 0; i < 7; i++) {
        const existing = mapped.find((s) => s.dayOfWeek === i);
        fullSchedule.push(
          existing || {
            dayOfWeek: i,
            enabled: true,
            openTime: i === 0 ? "06:00" : "06:00",
            closeTime: i === 0 ? "14:00" : "22:00",
          }
        );
      }

      setWeeklySchedule(fullSchedule);
    } catch (error) {
      console.error("Error fetching weekly schedule:", error);
      toast({
        title: "Greška",
        description: "Nije moguće učitati nedeljni raspored",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchExceptions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("kitchen_schedule_exceptions")
        .select("*")
        .is("company_id", null)
        .order("exception_date", { ascending: true });

      if (error) throw error;

      const mapped: ScheduleException[] = (data || []).map((row) => ({
        id: row.id,
        date: row.exception_date,
        closedAllDay: row.closed_all_day,
        openTime: row.open_time?.substring(0, 5) || null,
        closeTime: row.close_time?.substring(0, 5) || null,
        note: row.note,
      }));

      setExceptions(mapped);
    } catch (error) {
      console.error("Error fetching exceptions:", error);
    }
  }, []);

  const updateWeeklySchedule = useCallback(
    async (schedule: WeeklySchedule[]) => {
      setSaving(true);
      try {
        // Upsert each day
        for (const day of schedule) {
          // Build upsert data - only include id if we have one
          const upsertData: Record<string, any> = {
            company_id: null,
            day_of_week: day.dayOfWeek,
            enabled: day.enabled,
            open_time: day.openTime + ":00",
            close_time: day.closeTime + ":00",
          };
          
          // Only include id if it exists (for updating existing records)
          if (day.id) {
            upsertData.id = day.id;
          }

          const { error } = await supabase
            .from("kitchen_schedule_weekly")
            .upsert(upsertData as any, { onConflict: "company_id,day_of_week" });

          if (error) throw error;
        }

        toast({
          title: "Uspešno",
          description: "Nedeljni raspored je sačuvan",
        });

        await fetchWeeklySchedule();
      } catch (error) {
        console.error("Error updating weekly schedule:", error);
        toast({
          title: "Greška",
          description: "Nije moguće sačuvati raspored",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    },
    [fetchWeeklySchedule, toast]
  );

  const addException = useCallback(
    async (exception: Omit<ScheduleException, "id">) => {
      setSaving(true);
      try {
        const { error } = await supabase.from("kitchen_schedule_exceptions").insert({
          company_id: null,
          exception_date: exception.date,
          closed_all_day: exception.closedAllDay,
          open_time: exception.openTime ? exception.openTime + ":00" : null,
          close_time: exception.closeTime ? exception.closeTime + ":00" : null,
          note: exception.note,
        });

        if (error) throw error;

        toast({
          title: "Uspešno",
          description: "Izuzetak je dodat",
        });

        await fetchExceptions();
      } catch (error: any) {
        console.error("Error adding exception:", error);
        const message = error.code === "23505" 
          ? "Izuzetak za ovaj datum već postoji" 
          : "Nije moguće dodati izuzetak";
        toast({
          title: "Greška",
          description: message,
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    },
    [fetchExceptions, toast]
  );

  const updateException = useCallback(
    async (id: string, exception: Partial<ScheduleException>) => {
      setSaving(true);
      try {
        const updateData: Record<string, any> = {};
        if (exception.date !== undefined) updateData.exception_date = exception.date;
        if (exception.closedAllDay !== undefined) updateData.closed_all_day = exception.closedAllDay;
        if (exception.openTime !== undefined) updateData.open_time = exception.openTime ? exception.openTime + ":00" : null;
        if (exception.closeTime !== undefined) updateData.close_time = exception.closeTime ? exception.closeTime + ":00" : null;
        if (exception.note !== undefined) updateData.note = exception.note;

        const { error } = await supabase
          .from("kitchen_schedule_exceptions")
          .update(updateData)
          .eq("id", id);

        if (error) throw error;

        toast({
          title: "Uspešno",
          description: "Izuzetak je ažuriran",
        });

        await fetchExceptions();
      } catch (error) {
        console.error("Error updating exception:", error);
        toast({
          title: "Greška",
          description: "Nije moguće ažurirati izuzetak",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    },
    [fetchExceptions, toast]
  );

  const deleteException = useCallback(
    async (id: string) => {
      setSaving(true);
      try {
        const { error } = await supabase
          .from("kitchen_schedule_exceptions")
          .delete()
          .eq("id", id);

        if (error) throw error;

        toast({
          title: "Uspešno",
          description: "Izuzetak je obrisan",
        });

        await fetchExceptions();
      } catch (error) {
        console.error("Error deleting exception:", error);
        toast({
          title: "Greška",
          description: "Nije moguće obrisati izuzetak",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    },
    [fetchExceptions, toast]
  );

  useEffect(() => {
    fetchWeeklySchedule();
    fetchExceptions();
  }, [fetchWeeklySchedule, fetchExceptions]);

  return {
    weeklySchedule,
    exceptions,
    loading,
    saving,
    dayNames: DAY_NAMES,
    fetchWeeklySchedule,
    updateWeeklySchedule,
    fetchExceptions,
    addException,
    updateException,
    deleteException,
    setWeeklySchedule,
  };
}
