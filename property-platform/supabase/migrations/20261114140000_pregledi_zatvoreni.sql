-- Одит №15, стъпка 2: старият брояч на прегледи не се вика отвън.
--
-- Сайтът вече брои прегледите през pregled_na_obyava_srv (с тайния низ
-- на сървъра). Старата функция позволяваше на всеки да надуе прегледите
-- на която и да е обява с публичния ключ.

revoke execute on function public.increment_listing_view(uuid) from public, anon, authenticated;
