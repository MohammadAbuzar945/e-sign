INSERT INTO "User" ("email", "name") VALUES (
  'serviceaccount@nomiadocs.com',
  'Service Account'
) ON CONFLICT DO NOTHING;
