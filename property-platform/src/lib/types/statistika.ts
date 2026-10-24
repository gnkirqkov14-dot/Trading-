/** Каквото връща `admin_statistika()` (миграция 20261025090000). */
export type Statistika = {
  sega: number;
  periodi: { ime: string; posetiteli: number; stranici: number; sredno_sek: number }[];
  iztochnitsi: { iztochnik: string; posetiteli: number }[];
  ustroistva: { ustroistvo: string; posetiteli: number }[];
  stranici: { pat: string; pregledi: number; posetiteli: number; sredno_sek: number }[];
  obqvi: {
    listing_id: string;
    title: string;
    pregledi: number;
    posetiteli: number;
    sredno_sek: number;
  }[];
  posledni: {
    zapochna: string;
    pat: string;
    sekundi: number;
    iztochnik: string | null;
    ustroistvo: string | null;
    title: string | null;
    aktiven: boolean;
  }[];
};
