-- Одит №14, стъпка 2: старите проверки вече не се викат отвън.
--
-- Сайтът ползва proveri_telefon_srv и blokiran_kontakt_srv (с тайния низ
-- на сървъра). Тук се спира прекият достъп до старите две функции, за да
-- не може с публичния ключ да се пита кой номер има профил и кой контакт
-- е блокиран. Тригерите и новите функции ги викат като собственик и
-- продължават да работят.

revoke execute on function public.proveri_telefon(text) from public, anon, authenticated;
revoke execute on function public.is_contact_banned(text, text) from public, anon, authenticated;
