create index if not exists crypto_rollback_rehearsals_candidate_checkpoint_idx
  on public.crypto_rollback_rehearsals(candidate_checkpoint_id)
  where candidate_checkpoint_id is not null;
