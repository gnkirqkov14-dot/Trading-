-- Махане на Viber наблюдението, по искане на собственика.
--
-- Опитът беше: робот на Mac-а снима прозореца на Viber, сървърът разчита
-- снимката и таблото показва кой чака отговор. Стигна до работеща верига, но
-- собственикът прецени, че не му върши работа, и поиска всичко да се върне
-- както е било — включително данните.
--
-- Затова тук няма "изключено, но запазено за после": таблиците падат заедно
-- със съдържанието си. Държането на чужда кореспонденция "за всеки случай"
-- след като собственикът е казал да я няма, е грешният избор.
--
-- Ако някой ден темата се върне, миграции 0027–0032 стоят в историята на git
-- и там е записано и какво НЕ проработи: българският Viber не пише "Вие:"
-- пред своите съобщения, отметките ✓✓ са няколко точки и при малка снимка се
-- губят, а едно име се разчита по няколко различни начина и става на няколко
-- разговора. Това е същинската причина опитът да не е убедителен — не кодът.

drop function if exists public.viber_ingest(text, jsonb);
drop function if exists public.viber_ingest(text, jsonb, integer);
drop function if exists public.viber_set_ignored(text, boolean);
drop function if exists public.viber_chat_key(text);
drop function if exists public.viber_claim_slot(text, integer, integer, integer, integer, bigint);
drop function if exists public.viber_claim_slot(text, integer, integer, integer);
drop function if exists public.viber_spend_alert(text);
drop function if exists public.viber_claim_question(integer, integer, bigint);

drop table if exists public.viber_observations;
drop table if exists public.viber_chats;
drop table if exists public.viber_ask_quota;
drop table if exists public.viber_agents;
