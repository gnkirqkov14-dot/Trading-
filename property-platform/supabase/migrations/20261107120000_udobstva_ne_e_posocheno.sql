-- Паркомясто, асансьор, тераса и обзавеждане вече имат три стойности:
-- true = Да, false = Не, null = Не е посочено. При ръчна обява формата
-- праща Да/Не както досега (по подразбиране false); при пакетен внос
-- непосоченото остава null, вместо да се записва като „Не“.
alter table public.listings
  alter column has_parking drop not null,
  alter column has_elevator drop not null,
  alter column has_terrace drop not null,
  alter column is_furnished drop not null;
