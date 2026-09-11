-- ВРЕМЕННО ЗА СТАРТА: собственикът поиска да скрием плащанията в началото
-- на маркетинга — пълен достъп (включително писане на съобщения) за
-- всички регистрирани потребители, без абонамент. Само UI/server-action
-- проверката (hasFullSearchAccess в listing-labels.ts) НЕ е достатъчна —
-- приложението ползва публичен anon/authenticated ключ, RLS е реалната
-- граница за сигурност (виж коментара в 0008_search_subscription_paywall.sql),
-- затова трябва да сменим и самата policy, иначе insert-ите щяха да се
-- отхвърлят реално от базата въпреки UI промяната.
--
-- За да върнем платения достъп занапред: пресъздай policy-то от
-- 0008_search_subscription_paywall.sql (subscription_plan <> 'basic'
-- проверката) И смени hasFullSearchAccess() обратно.

drop policy if exists "Paid subscribers or listing owners can send messages" on public.messages;

create policy "Authenticated users can send messages as themselves"
  on public.messages for insert
  with check (auth.uid() = from_user_id);
