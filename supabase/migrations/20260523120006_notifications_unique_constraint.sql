ALTER TABLE public.notifications
  ADD CONSTRAINT uq_notif_cert_alerte_dest
  UNIQUE (certification_id, type_alerte, destinataire_id);
