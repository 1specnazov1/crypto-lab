create index if not exists crypto_x_conversation_opportunities_source_id_idx
  on public.crypto_x_conversation_opportunities(source_id)
  where source_id is not null;
