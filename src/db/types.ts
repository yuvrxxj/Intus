// Generated from the live project with Supabase's generate_typescript_types. Regenerate after any schema change.
// Caution: numeric columns are typed as number here, but PostgREST can hand them back as strings, so anything
// that reads a numeric column for a decision goes through src/lib/numbers.ts instead of trusting the type.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      action_items: {
        Row: {
          category: string | null;
          done: boolean | null;
          id: string;
          priority: string | null;
          sort_order: number | null;
          text: string;
        };
        Insert: {
          category?: string | null;
          done?: boolean | null;
          id: string;
          priority?: string | null;
          sort_order?: number | null;
          text: string;
        };
        Update: {
          category?: string | null;
          done?: boolean | null;
          id?: string;
          priority?: string | null;
          sort_order?: number | null;
          text?: string;
        };
        Relationships: [];
      };
      app_owner: {
        Row: { created_at: string; user_id: string };
        Insert: { created_at?: string; user_id: string };
        Update: { created_at?: string; user_id?: string };
        Relationships: [];
      };
      biomarker_readings: {
        Row: {
          biomarker_id: string;
          created_at: string;
          id: string;
          measured_at: string;
          notes: string | null;
          source: string | null;
          status: string | null;
          value: number;
        };
        Insert: {
          biomarker_id: string;
          created_at?: string;
          id?: string;
          measured_at: string;
          notes?: string | null;
          source?: string | null;
          status?: string | null;
          value: number;
        };
        Update: {
          biomarker_id?: string;
          created_at?: string;
          id?: string;
          measured_at?: string;
          notes?: string | null;
          source?: string | null;
          status?: string | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'biomarker_readings_biomarker_id_fkey';
            columns: ['biomarker_id'];
            isOneToOne: false;
            referencedRelation: 'biomarkers';
            referencedColumns: ['id'];
          },
        ];
      };
      biomarkers: {
        Row: {
          category: string;
          code: string;
          created_at: string;
          critical_high: number | null;
          critical_low: number | null;
          description: string | null;
          id: string;
          name: string;
          optimal_high: number | null;
          optimal_low: number | null;
          organ_systems: string[];
          ref_high: number | null;
          ref_low: number | null;
          sort_order: number | null;
          threshold_source: string | null;
          unit: string;
        };
        Insert: {
          category: string;
          code: string;
          created_at?: string;
          critical_high?: number | null;
          critical_low?: number | null;
          description?: string | null;
          id?: string;
          name: string;
          optimal_high?: number | null;
          optimal_low?: number | null;
          organ_systems?: string[];
          ref_high?: number | null;
          ref_low?: number | null;
          sort_order?: number | null;
          threshold_source?: string | null;
          unit: string;
        };
        Update: {
          category?: string;
          code?: string;
          created_at?: string;
          critical_high?: number | null;
          critical_low?: number | null;
          description?: string | null;
          id?: string;
          name?: string;
          optimal_high?: number | null;
          optimal_low?: number | null;
          organ_systems?: string[];
          ref_high?: number | null;
          ref_low?: number | null;
          sort_order?: number | null;
          threshold_source?: string | null;
          unit?: string;
        };
        Relationships: [];
      };
      body_composition: {
        Row: {
          bmi: number | null;
          body_fat_pct: number | null;
          bone_mass_kg: number | null;
          created_at: string;
          id: string;
          lean_mass_kg: number | null;
          measured_at: string;
          muscle_mass_kg: number | null;
          visceral_fat: number | null;
          water_pct: number | null;
          weight_kg: number | null;
        };
        Insert: {
          bmi?: number | null;
          body_fat_pct?: number | null;
          bone_mass_kg?: number | null;
          created_at?: string;
          id?: string;
          lean_mass_kg?: number | null;
          measured_at: string;
          muscle_mass_kg?: number | null;
          visceral_fat?: number | null;
          water_pct?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          bmi?: number | null;
          body_fat_pct?: number | null;
          bone_mass_kg?: number | null;
          created_at?: string;
          id?: string;
          lean_mass_kg?: number | null;
          measured_at?: string;
          muscle_mass_kg?: number | null;
          visceral_fat?: number | null;
          water_pct?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      cardio_metrics: {
        Row: {
          created_at: string;
          hrv_ms: number | null;
          id: string;
          max_hr: number | null;
          measured_at: string;
          recovery_hr: number | null;
          resting_hr: number | null;
          vo2_max: number | null;
        };
        Insert: {
          created_at?: string;
          hrv_ms?: number | null;
          id?: string;
          max_hr?: number | null;
          measured_at: string;
          recovery_hr?: number | null;
          resting_hr?: number | null;
          vo2_max?: number | null;
        };
        Update: {
          created_at?: string;
          hrv_ms?: number | null;
          id?: string;
          max_hr?: number | null;
          measured_at?: string;
          recovery_hr?: number | null;
          resting_hr?: number | null;
          vo2_max?: number | null;
        };
        Relationships: [];
      };
      daily_logs: {
        Row: {
          active_kcal: number | null;
          carbs: number | null;
          cardio: string | null;
          cigs: number | null;
          core: string | null;
          fat: number | null;
          id: string;
          lift: string | null;
          log_date: string;
          mood: number | null;
          mood_notes: string | null;
          protein: number | null;
          rings: Json | null;
          saved_at: string | null;
          steps: number | null;
          supplements: Json | null;
          total_cals: number | null;
          water_ml: number | null;
          weight: number | null;
        };
        Insert: {
          active_kcal?: number | null;
          carbs?: number | null;
          cardio?: string | null;
          cigs?: number | null;
          core?: string | null;
          fat?: number | null;
          id?: string;
          lift?: string | null;
          log_date: string;
          mood?: number | null;
          mood_notes?: string | null;
          protein?: number | null;
          rings?: Json | null;
          saved_at?: string | null;
          steps?: number | null;
          supplements?: Json | null;
          total_cals?: number | null;
          water_ml?: number | null;
          weight?: number | null;
        };
        Update: {
          active_kcal?: number | null;
          carbs?: number | null;
          cardio?: string | null;
          cigs?: number | null;
          core?: string | null;
          fat?: number | null;
          id?: string;
          lift?: string | null;
          log_date?: string;
          mood?: number | null;
          mood_notes?: string | null;
          protein?: number | null;
          rings?: Json | null;
          saved_at?: string | null;
          steps?: number | null;
          supplements?: Json | null;
          total_cals?: number | null;
          water_ml?: number | null;
          weight?: number | null;
        };
        Relationships: [];
      };
      devices: {
        Row: { id: string; kind: string | null; last_sync: string | null; name: string; status: string | null };
        Insert: { id: string; kind?: string | null; last_sync?: string | null; name: string; status?: string | null };
        Update: { id?: string; kind?: string | null; last_sync?: string | null; name?: string; status?: string | null };
        Relationships: [];
      };
      diagnoses: {
        Row: {
          condition: string;
          created_at: string;
          diagnosed_date: string | null;
          id: string;
          notes: string | null;
          status: string;
        };
        Insert: {
          condition: string;
          created_at?: string;
          diagnosed_date?: string | null;
          id?: string;
          notes?: string | null;
          status?: string;
        };
        Update: {
          condition?: string;
          created_at?: string;
          diagnosed_date?: string | null;
          id?: string;
          notes?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      meals: {
        Row: {
          carbs: number | null;
          emoji: string | null;
          fat: number | null;
          id: string;
          kcal: number | null;
          log_date: string;
          logged_at: string | null;
          meal: string;
          name: string;
          protein: number | null;
        };
        Insert: {
          carbs?: number | null;
          emoji?: string | null;
          fat?: number | null;
          id?: string;
          kcal?: number | null;
          log_date?: string;
          logged_at?: string | null;
          meal: string;
          name: string;
          protein?: number | null;
        };
        Update: {
          carbs?: number | null;
          emoji?: string | null;
          fat?: number | null;
          id?: string;
          kcal?: number | null;
          log_date?: string;
          logged_at?: string | null;
          meal?: string;
          name?: string;
          protein?: number | null;
        };
        Relationships: [];
      };
      medications: {
        Row: {
          active: boolean | null;
          created_at: string;
          dosage: string | null;
          doses_per_day: number | null;
          end_date: string | null;
          frequency: string | null;
          id: string;
          name: string;
          notes: string | null;
          paracetamol_mg_per_dose: number | null;
          start_date: string | null;
        };
        Insert: {
          active?: boolean | null;
          created_at?: string;
          dosage?: string | null;
          doses_per_day?: number | null;
          end_date?: string | null;
          frequency?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          paracetamol_mg_per_dose?: number | null;
          start_date?: string | null;
        };
        Update: {
          active?: boolean | null;
          created_at?: string;
          dosage?: string | null;
          doses_per_day?: number | null;
          end_date?: string | null;
          frequency?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          paracetamol_mg_per_dose?: number | null;
          start_date?: string | null;
        };
        Relationships: [];
      };
      photo_log: {
        Row: { id: string; label: string | null; log_date: string; photo_url: string | null; weight: number | null };
        Insert: { id?: string; label?: string | null; log_date: string; photo_url?: string | null; weight?: number | null };
        Update: { id?: string; label?: string | null; log_date?: string; photo_url?: string | null; weight?: number | null };
        Relationships: [];
      };
      profile: {
        Row: {
          age: number | null;
          bf_goal: number | null;
          bf_start: number | null;
          blood_type: string | null;
          calorie_target: number | null;
          carb_target: number | null;
          family_colorectal_cancer: boolean;
          family_prostate_cancer: boolean;
          fat_target: number | null;
          goal_date: string | null;
          goal_weight: number | null;
          height_cm: number | null;
          id: string;
          initials: string | null;
          name: string | null;
          noise_or_blast_exposure: boolean;
          onboarded: boolean | null;
          protein_target: number | null;
          sex: string | null;
          sleep_goal: number | null;
          start_date: string | null;
          start_weight: number | null;
          step_target: number | null;
          updated_at: string | null;
          water_target: number | null;
        };
        Insert: {
          age?: number | null;
          bf_goal?: number | null;
          bf_start?: number | null;
          blood_type?: string | null;
          calorie_target?: number | null;
          carb_target?: number | null;
          family_colorectal_cancer?: boolean;
          family_prostate_cancer?: boolean;
          fat_target?: number | null;
          goal_date?: string | null;
          goal_weight?: number | null;
          height_cm?: number | null;
          id?: string;
          initials?: string | null;
          name?: string | null;
          noise_or_blast_exposure?: boolean;
          onboarded?: boolean | null;
          protein_target?: number | null;
          sex?: string | null;
          sleep_goal?: number | null;
          start_date?: string | null;
          start_weight?: number | null;
          step_target?: number | null;
          updated_at?: string | null;
          water_target?: number | null;
        };
        Update: {
          age?: number | null;
          bf_goal?: number | null;
          bf_start?: number | null;
          blood_type?: string | null;
          calorie_target?: number | null;
          carb_target?: number | null;
          family_colorectal_cancer?: boolean;
          family_prostate_cancer?: boolean;
          fat_target?: number | null;
          goal_date?: string | null;
          goal_weight?: number | null;
          height_cm?: number | null;
          id?: string;
          initials?: string | null;
          name?: string | null;
          noise_or_blast_exposure?: boolean;
          onboarded?: boolean | null;
          protein_target?: number | null;
          sex?: string | null;
          sleep_goal?: number | null;
          start_date?: string | null;
          start_weight?: number | null;
          step_target?: number | null;
          updated_at?: string | null;
          water_target?: number | null;
        };
        Relationships: [];
      };
      screening_history: {
        Row: { created_at: string; done_date: string; id: string; notes: string | null; screening_code: string };
        Insert: { created_at?: string; done_date: string; id?: string; notes?: string | null; screening_code: string };
        Update: { created_at?: string; done_date?: string; id?: string; notes?: string | null; screening_code?: string };
        Relationships: [
          {
            foreignKeyName: 'screening_history_screening_code_fkey';
            columns: ['screening_code'];
            isOneToOne: false;
            referencedRelation: 'screening_rules';
            referencedColumns: ['code'];
          },
        ];
      };
      screening_rules: {
        Row: {
          code: string;
          interval_years: number | null;
          label: string;
          max_age: number | null;
          min_age: number | null;
          rationale: string | null;
          requires_flag: string | null;
          sex: string | null;
          sort_order: number;
        };
        Insert: {
          code: string;
          interval_years?: number | null;
          label: string;
          max_age?: number | null;
          min_age?: number | null;
          rationale?: string | null;
          requires_flag?: string | null;
          sex?: string | null;
          sort_order?: number;
        };
        Update: {
          code?: string;
          interval_years?: number | null;
          label?: string;
          max_age?: number | null;
          min_age?: number | null;
          rationale?: string | null;
          requires_flag?: string | null;
          sex?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      supplement_catalog: {
        Row: {
          daily: boolean | null;
          dose: string | null;
          id: string;
          name: string;
          sort_order: number | null;
          sunday_only: boolean | null;
          tag: string | null;
          when_taken: string | null;
        };
        Insert: {
          daily?: boolean | null;
          dose?: string | null;
          id: string;
          name: string;
          sort_order?: number | null;
          sunday_only?: boolean | null;
          tag?: string | null;
          when_taken?: string | null;
        };
        Update: {
          daily?: boolean | null;
          dose?: string | null;
          id?: string;
          name?: string;
          sort_order?: number | null;
          sunday_only?: boolean | null;
          tag?: string | null;
          when_taken?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database['public']['Tables'];

export type Row<T extends keyof PublicTables> = PublicTables[T]['Row'];
export type Insert<T extends keyof PublicTables> = PublicTables[T]['Insert'];
