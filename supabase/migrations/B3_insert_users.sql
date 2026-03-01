-- INSERÇÃO DE 406 USERS NO NOVO SUPABASE
-- Executar no SQL Editor de dmprkdvkzzjtixlatnlx
-- Password temporária: IVAzen-Temp-2026!

BEGIN;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0bfa4274-7ae0-439b-b0b9-89b939ee6662', 'authenticated', 'authenticated', 'els.vanloock@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-07T00:06:28.071788Z', '2026-02-07T00:06:28.071788Z', '2026-02-07T00:06:28.516477Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b85ea3dd-c8e7-4689-b879-e139adfc53d2', 'authenticated', 'authenticated', 'surfin.coffeebowls@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-07T00:06:27.076917Z', '2026-02-07T00:06:27.076917Z', '2026-02-07T00:06:27.497963Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ec6a41bf-2c23-4bac-bf0c-cc41473a12a7', 'authenticated', 'authenticated', 'geral@mathilde.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-07T00:06:26.105794Z', '2026-02-07T00:06:26.105794Z', '2026-02-07T00:06:26.538289Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '81d59d3d-7205-4e5d-836f-48cd70562d55', 'authenticated', 'authenticated', 'gaspar-triatleta@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-07T00:06:25.156521Z', '2026-02-07T00:06:25.156521Z', '2026-02-07T00:06:25.578197Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'c77e5671-1849-4d3f-944d-cfbbf9bffd0d', 'authenticated', 'authenticated', 'info@villesauvage.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-07T00:06:24.205989Z', '2026-02-07T00:06:24.205989Z', '2026-02-07T00:06:24.644104Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '117e2a69-2c8f-4fa8-b774-be09fb4bbc4b', 'authenticated', 'authenticated', 'payments@envisioning.io', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-07T00:06:00.732957Z', '2026-02-07T00:06:00.732957Z', '2026-02-07T00:06:01.242363Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'c1687bde-c56b-4b8f-bf3f-491e1d265d90', 'authenticated', 'authenticated', 'obrasmoderadas@sapo.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:51:05.654893Z', '2026-02-06T23:51:05.654893Z', '2026-02-06T23:51:06.112734Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '82735cf3-7dd4-4ef7-b930-1afc4e7f43af', 'authenticated', 'authenticated', 'paula.moura.estil@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:50:57.319716Z', '2026-02-06T23:50:57.319716Z', '2026-02-06T23:50:57.760431Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'd6fd56d9-7815-497a-ab8a-b2a2ee99c7be', 'authenticated', 'authenticated', 'info@defakto-uhren.de', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:50:55.679498Z', '2026-02-06T23:50:55.679498Z', '2026-02-06T23:50:56.106929Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1471672d-0aa7-484b-856d-26d0ffcd7e17', 'authenticated', 'authenticated', 'ana.oliveira@acconsulting.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:50:41.965697Z', '2026-02-06T23:50:41.965697Z', '2026-02-06T23:50:42.385487Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '93f40486-6140-4ac6-8eed-d175f6bca177', 'authenticated', 'authenticated', 'fin.dep@magonol.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:50:40.964177Z', '2026-02-06T23:50:40.964177Z', '2026-02-06T23:50:41.386921Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '3b289cf4-a669-4bd9-b514-c97bf487bb1c', 'authenticated', 'authenticated', 'geral@aad.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:50:39.546245Z', '2026-02-06T23:50:39.546245Z', '2026-02-06T23:50:39.960245Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '32165298-5f2f-4c78-b88f-4407a9288865', 'authenticated', 'authenticated', 'silva.egidio@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:50:38.4607Z', '2026-02-06T23:50:38.4607Z', '2026-02-06T23:50:38.946168Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'aacf7af4-edb1-4984-80b6-6fcf43c96a24', 'authenticated', 'authenticated', 'kosta.consult@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:50:37.458363Z', '2026-02-06T23:50:37.458363Z', '2026-02-06T23:50:37.895169Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '80d397a4-546c-4a30-835e-75486b7b31ae', 'authenticated', 'authenticated', 'geral@and-pt.org', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:50:35.278047Z', '2026-02-06T23:50:35.278047Z', '2026-02-06T23:50:35.695303Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b1e8226e-4205-4a56-ba34-53c29490ba1d', 'authenticated', 'authenticated', 'geral@talentoeespaco.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:50:34.372435Z', '2026-02-06T23:50:34.372435Z', '2026-02-06T23:50:34.781372Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '69508026-def4-4c15-8cd0-7701a5d9521c', 'authenticated', 'authenticated', 'celianogal@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:50:33.383627Z', '2026-02-06T23:50:33.383627Z', '2026-02-06T23:50:33.805156Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0d3c2021-77ce-450d-a015-578e67350a25', 'authenticated', 'authenticated', 'geral.acravo@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:50:30.790924Z', '2026-02-06T23:50:30.790924Z', '2026-02-06T23:50:31.206891Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4d68578a-8126-4d08-9c18-01036abde905', 'authenticated', 'authenticated', 'pjoviality@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:50:29.657338Z', '2026-02-06T23:50:29.657338Z', '2026-02-06T23:50:30.078187Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7a207303-3ad4-448e-adf6-c74a01a4c3cd', 'authenticated', 'authenticated', 'dianagodolphin.cabeleireiro@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:50:28.59824Z', '2026-02-06T23:50:28.59824Z', '2026-02-06T23:50:29.070526Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0e8a3f9c-2019-4a43-b4d0-6c8ca08ff143', 'authenticated', 'authenticated', '198633149.a2187630@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:40:00.452652Z', '2026-02-06T23:40:00.452652Z', '2026-02-06T23:40:00.457411Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ff70a9ba-966f-4a85-a6bc-d1052ef3c99a', 'authenticated', 'authenticated', '259531235.f38b1f98@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:59.514807Z', '2026-02-06T23:39:59.514807Z', '2026-02-06T23:39:59.517939Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4be9a13f-321b-4143-9b92-b88726ce7291', 'authenticated', 'authenticated', '308707265.d044f35e@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:58.581035Z', '2026-02-06T23:39:58.581035Z', '2026-02-06T23:39:58.584243Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0701db00-bc0f-4fbd-a6b4-ddb9ae834df6', 'authenticated', 'authenticated', '227908635.83928ca8@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:57.675585Z', '2026-02-06T23:39:57.675585Z', '2026-02-06T23:39:57.678569Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '956e19e4-aa22-4e2e-93e5-6eea4145ac04', 'authenticated', 'authenticated', '109632303.9e48b159@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:56.779063Z', '2026-02-06T23:39:56.779063Z', '2026-02-06T23:39:56.782073Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '98d88bfc-f4ce-455f-aa5a-cccce55db652', 'authenticated', 'authenticated', '180143034.8008ed36@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:55.867483Z', '2026-02-06T23:39:55.867483Z', '2026-02-06T23:39:55.870701Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'f3c61ee4-3af4-4f4a-bbd1-902ba7f5d8a4', 'authenticated', 'authenticated', '306967308.76ce0ff8@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:54.904131Z', '2026-02-06T23:39:54.904131Z', '2026-02-06T23:39:54.907303Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '289ab8a3-fd7f-4bce-9a5c-9bfbba952485', 'authenticated', 'authenticated', '293882746.d114997b@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:54.017024Z', '2026-02-06T23:39:54.017024Z', '2026-02-06T23:39:54.021161Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '25472da1-810a-4122-8373-3f025d456769', 'authenticated', 'authenticated', '243017375.14599eb3@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:53.116425Z', '2026-02-06T23:39:53.116425Z', '2026-02-06T23:39:53.119644Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '98d84c72-5879-45c8-bfbf-eaa6043156f4', 'authenticated', 'authenticated', '232883793.7ed06ad6@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:52.209462Z', '2026-02-06T23:39:52.209462Z', '2026-02-06T23:39:52.214837Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '90b4d91f-ecf8-4ae5-bcc5-5b172ec35473', 'authenticated', 'authenticated', '188858270.dee87e2d@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:51.298736Z', '2026-02-06T23:39:51.298736Z', '2026-02-06T23:39:51.303049Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '6ee21d3f-8a8f-4adb-844b-118538bc1304', 'authenticated', 'authenticated', '263421333.b066a8ac@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:50.393991Z', '2026-02-06T23:39:50.393991Z', '2026-02-06T23:39:50.397079Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'aae81613-4fc4-4b4c-aa8e-d001258b8318', 'authenticated', 'authenticated', '272964646.7ad7f1f2@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:49.476043Z', '2026-02-06T23:39:49.476043Z', '2026-02-06T23:39:49.479143Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '97cd141c-7edd-4594-be3b-a71d0f9fe0b8', 'authenticated', 'authenticated', '303614730.68b689c2@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:48.448492Z', '2026-02-06T23:39:48.448492Z', '2026-02-06T23:39:48.451623Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ff9371eb-6d58-4eba-803a-55f2688d2217', 'authenticated', 'authenticated', '303615109.da7f6fe7@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:47.52103Z', '2026-02-06T23:39:47.52103Z', '2026-02-06T23:39:47.525695Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '5615b7f9-86bf-45d7-878b-6f7d4ea0b9b9', 'authenticated', 'authenticated', '270676520.2d0b619b@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:46.595205Z', '2026-02-06T23:39:46.595205Z', '2026-02-06T23:39:46.598207Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '88a7ca79-0752-4f41-80b0-17b5dc643db5', 'authenticated', 'authenticated', '200817027.3c3e9c1c@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:45.702607Z', '2026-02-06T23:39:45.702607Z', '2026-02-06T23:39:45.705496Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'eff4b9ae-2741-4ed8-8188-ae1b0683c58a', 'authenticated', 'authenticated', '318038625.588e8957@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:44.786422Z', '2026-02-06T23:39:44.786422Z', '2026-02-06T23:39:44.790861Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '34822ce8-abc4-4046-a14f-aee145a62a07', 'authenticated', 'authenticated', '313715386.12eb2c6c@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:43.881642Z', '2026-02-06T23:39:43.881642Z', '2026-02-06T23:39:43.884744Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '788de024-6d15-45e2-8128-cd7609efbb0f', 'authenticated', 'authenticated', '234931965.501fb347@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:42.945074Z', '2026-02-06T23:39:42.945074Z', '2026-02-06T23:39:42.948176Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '70c2a6be-d0a6-4127-b1af-b1ef0c589fc9', 'authenticated', 'authenticated', '304448508.9c7188f0@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:42.042919Z', '2026-02-06T23:39:42.042919Z', '2026-02-06T23:39:42.045943Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '24bbc564-4e78-4404-bb9d-487ff43b2d0d', 'authenticated', 'authenticated', '318870410.8ec3b421@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:41.150712Z', '2026-02-06T23:39:41.150712Z', '2026-02-06T23:39:41.153657Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '698e56f2-d6b7-488f-9797-2bc57291572d', 'authenticated', 'authenticated', '185486711.a458801d@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:40.248913Z', '2026-02-06T23:39:40.248913Z', '2026-02-06T23:39:40.251892Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '069c83c5-28bb-4da6-8ee1-bb7f8b6fa8c9', 'authenticated', 'authenticated', '305128310.0c28ff32@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:39.331811Z', '2026-02-06T23:39:39.331811Z', '2026-02-06T23:39:39.334894Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ece8d917-13f9-40af-96f4-e7019ba72223', 'authenticated', 'authenticated', '320369480.2274adf7@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:38.4349Z', '2026-02-06T23:39:38.4349Z', '2026-02-06T23:39:38.438008Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '424adccd-f14e-48f3-9a54-7b818c3a0df0', 'authenticated', 'authenticated', '322597080.8656128d@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:37.202865Z', '2026-02-06T23:39:37.202865Z', '2026-02-06T23:39:37.20658Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '73a905cb-9684-45ab-aa30-eff9b8eaae7e', 'authenticated', 'authenticated', '319649466.3e95f510@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:36.290976Z', '2026-02-06T23:39:36.290976Z', '2026-02-06T23:39:36.293928Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4455ad49-1886-45a9-99fa-e38919c0053d', 'authenticated', 'authenticated', '215515170.0d496590@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:35.367455Z', '2026-02-06T23:39:35.367455Z', '2026-02-06T23:39:35.372143Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '84e82503-9050-414f-952f-0273f1381bf1', 'authenticated', 'authenticated', '309163579.f6838f97@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:34.435932Z', '2026-02-06T23:39:34.435932Z', '2026-02-06T23:39:34.439105Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '2cd379b4-0fc5-4fa4-b79a-799f36c4cef3', 'authenticated', 'authenticated', '191891932.c8eca500@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:33.514715Z', '2026-02-06T23:39:33.514715Z', '2026-02-06T23:39:33.517787Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1cdcac76-5ac9-41b3-9bd8-baebd058d4e3', 'authenticated', 'authenticated', '266675581.394f8864@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:32.558167Z', '2026-02-06T23:39:32.558167Z', '2026-02-06T23:39:32.56114Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b46f9e12-37a9-4307-8869-2fc2ff7dbdd5', 'authenticated', 'authenticated', '296845418.1246e45e@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:31.61823Z', '2026-02-06T23:39:31.61823Z', '2026-02-06T23:39:31.62138Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a3cf0d07-ae51-45ff-8021-5fd63045a1ec', 'authenticated', 'authenticated', '313715734.8ed17579@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:30.704435Z', '2026-02-06T23:39:30.704435Z', '2026-02-06T23:39:30.707461Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '10cb6b3d-6ce5-4577-a24e-c30ad17ed3db', 'authenticated', 'authenticated', '220765898.0f6c4a7b@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:29.774907Z', '2026-02-06T23:39:29.774907Z', '2026-02-06T23:39:29.779973Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'd3be05b1-3a37-4d93-8b58-0453d77c018d', 'authenticated', 'authenticated', '328371971.91d1bc31@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:28.841639Z', '2026-02-06T23:39:28.841639Z', '2026-02-06T23:39:28.844706Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e25f84e7-def9-4886-a810-d18245fbfef3', 'authenticated', 'authenticated', '218457375.1cb31bca@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:27.863551Z', '2026-02-06T23:39:27.863551Z', '2026-02-06T23:39:27.86802Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'd4b6f6cf-92e8-47e2-83b0-afda21ae0004', 'authenticated', 'authenticated', '309936853.1e5c05f7@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:26.936972Z', '2026-02-06T23:39:26.936972Z', '2026-02-06T23:39:26.940003Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '3b54937d-045a-44f9-9187-4e0a6bdcbe67', 'authenticated', 'authenticated', '322099927.903629da@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:25.99177Z', '2026-02-06T23:39:25.99177Z', '2026-02-06T23:39:25.994802Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '9506e8df-3c34-4159-b2af-b4aeff3f5bbb', 'authenticated', 'authenticated', '234880309.a8c02c4d@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:25.051867Z', '2026-02-06T23:39:25.051867Z', '2026-02-06T23:39:25.054993Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'c879796c-189b-498e-ac21-8bb4fa06adc2', 'authenticated', 'authenticated', '296694096.5577dc17@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:24.063896Z', '2026-02-06T23:39:24.063896Z', '2026-02-06T23:39:24.068369Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0a34ec52-3a81-4011-9acf-904654f2c985', 'authenticated', 'authenticated', '322096529.c4a43d50@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:23.099056Z', '2026-02-06T23:39:23.099056Z', '2026-02-06T23:39:23.101963Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '57fac9aa-50a7-4147-b59f-110efb4b021a', 'authenticated', 'authenticated', '318870223.c2760d7a@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:22.148828Z', '2026-02-06T23:39:22.148828Z', '2026-02-06T23:39:22.151945Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '3359d4eb-f83a-40bd-9cdc-f39e73a54b27', 'authenticated', 'authenticated', '322184720.43d62808@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:21.222733Z', '2026-02-06T23:39:21.222733Z', '2026-02-06T23:39:21.227167Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0be5dc0a-1efa-45ad-83e4-085884483dd8', 'authenticated', 'authenticated', '201981106.d456957a@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:20.267687Z', '2026-02-06T23:39:20.267687Z', '2026-02-06T23:39:20.270885Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'd540d933-071e-4b10-aaad-a4af55b158ab', 'authenticated', 'authenticated', '307103382.ff3a2682@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:19.209436Z', '2026-02-06T23:39:19.209436Z', '2026-02-06T23:39:19.212412Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b1c5a8cd-f6d2-4375-9853-328ba52cb807', 'authenticated', 'authenticated', '100814328.1ebf0f97@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:18.2788Z', '2026-02-06T23:39:18.2788Z', '2026-02-06T23:39:18.283859Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0855f18b-a9ac-49a4-ac9f-b6a174c71de6', 'authenticated', 'authenticated', '316555673.d69397d2@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:17.334307Z', '2026-02-06T23:39:17.334307Z', '2026-02-06T23:39:17.337417Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '5ec54856-188c-4617-9713-89a32a1956e7', 'authenticated', 'authenticated', '215224680.bc8701c0@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:16.367916Z', '2026-02-06T23:39:16.367916Z', '2026-02-06T23:39:16.370975Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e890cba0-8a4e-4549-a32f-2149f7582f45', 'authenticated', 'authenticated', '297001469.036ba44e@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:15.416888Z', '2026-02-06T23:39:15.416888Z', '2026-02-06T23:39:15.419874Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1b449d65-753a-458f-bbb5-2b5aaef9d4e2', 'authenticated', 'authenticated', '284602426.47f45df7@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:14.471045Z', '2026-02-06T23:39:14.471045Z', '2026-02-06T23:39:14.474115Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '37a99897-bd9e-4907-b83d-e5e0397696a9', 'authenticated', 'authenticated', '318516837.5f874e5c@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:13.541429Z', '2026-02-06T23:39:13.541429Z', '2026-02-06T23:39:13.544421Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e3f92e8b-77f4-4cb5-bc37-3978e8b9f381', 'authenticated', 'authenticated', '304720704.46a1664f@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:12.590364Z', '2026-02-06T23:39:12.590364Z', '2026-02-06T23:39:12.594421Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '69d677b3-6f25-4edd-b3d7-6ecddaf2aa39', 'authenticated', 'authenticated', '291056849.a29f6762@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:11.649914Z', '2026-02-06T23:39:11.649914Z', '2026-02-06T23:39:11.653826Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'dcb99b7f-23a6-4b29-987e-a191cb625ab6', 'authenticated', 'authenticated', '261188984.c65d1d13@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:10.709837Z', '2026-02-06T23:39:10.709837Z', '2026-02-06T23:39:10.712886Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'f6e6dcba-de70-4ca9-a89d-5d4687474b8a', 'authenticated', 'authenticated', '152848940.2161c83e@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:09.781121Z', '2026-02-06T23:39:09.781121Z', '2026-02-06T23:39:09.784104Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0670b78b-8ea3-4485-bbf5-55f4ff679461', 'authenticated', 'authenticated', '207201986.c6ca3a30@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:08.85342Z', '2026-02-06T23:39:08.85342Z', '2026-02-06T23:39:08.856513Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b8b76bc5-2450-4961-8a76-fb6aafedf9fc', 'authenticated', 'authenticated', '298100223.694946c7@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:07.917326Z', '2026-02-06T23:39:07.917326Z', '2026-02-06T23:39:07.920807Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '774179fa-408d-48ec-a7c0-40ad660c07a0', 'authenticated', 'authenticated', '300610300.75de39b8@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:06.986Z', '2026-02-06T23:39:06.986Z', '2026-02-06T23:39:06.989251Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '3b7aceaf-4683-4c82-b145-3386c5e82a2e', 'authenticated', 'authenticated', '294631771.8bf8b5d2@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:05.931051Z', '2026-02-06T23:39:05.931051Z', '2026-02-06T23:39:05.934149Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '00041437-4a11-4abd-ae79-1ecbc05981c8', 'authenticated', 'authenticated', '123576458.0828abb9@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:05.010958Z', '2026-02-06T23:39:05.010958Z', '2026-02-06T23:39:05.014841Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'db31e98f-9d2a-42db-9f66-2bf09f778799', 'authenticated', 'authenticated', '244729204.8d327ff3@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:04.086486Z', '2026-02-06T23:39:04.086486Z', '2026-02-06T23:39:04.090335Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'be763d1d-5d08-4f33-902a-c9c3d945f6fe', 'authenticated', 'authenticated', '271109041.d1f7fe2d@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:03.105311Z', '2026-02-06T23:39:03.105311Z', '2026-02-06T23:39:03.110138Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'eb063f8e-f79b-4b1d-9beb-7d2478c9fffb', 'authenticated', 'authenticated', '295108045.76fbfe46@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:02.169479Z', '2026-02-06T23:39:02.169479Z', '2026-02-06T23:39:02.17324Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'af0418ce-988a-4d48-ace8-223b83cf30b6', 'authenticated', 'authenticated', '307497755.da92cc3b@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:01.205569Z', '2026-02-06T23:39:01.205569Z', '2026-02-06T23:39:01.21177Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '6d452e23-ec13-4078-9cf2-1620a38d6122', 'authenticated', 'authenticated', '190443022.252aa545@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:39:00.269136Z', '2026-02-06T23:39:00.269136Z', '2026-02-06T23:39:00.272177Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7effdc65-eb6f-4c5c-9c12-3d9187e2646b', 'authenticated', 'authenticated', '213599023.880c1210@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:59.329716Z', '2026-02-06T23:38:59.329716Z', '2026-02-06T23:38:59.336787Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '2adb5fc0-b9f3-4655-9ffe-78ec2c7c7e43', 'authenticated', 'authenticated', '267331762.c0622456@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:58.389609Z', '2026-02-06T23:38:58.389609Z', '2026-02-06T23:38:58.392736Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e1351d23-ae4c-42c5-826d-cdc4d5cde5c2', 'authenticated', 'authenticated', '270405658.09754246@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:57.398792Z', '2026-02-06T23:38:57.398792Z', '2026-02-06T23:38:57.403414Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '2c338c99-ca32-4766-b867-5465efb73131', 'authenticated', 'authenticated', '212321986.9821eab7@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:56.470955Z', '2026-02-06T23:38:56.470955Z', '2026-02-06T23:38:56.476759Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0e55f3e2-b865-4ee7-af57-aecc51866238', 'authenticated', 'authenticated', '211655864.a267a1c2@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:55.557142Z', '2026-02-06T23:38:55.557142Z', '2026-02-06T23:38:55.560428Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '40ff77a9-7f04-455e-9953-df844c9c69b4', 'authenticated', 'authenticated', '303069864.3aacbc0b@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:54.640621Z', '2026-02-06T23:38:54.640621Z', '2026-02-06T23:38:54.645974Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '86b383d0-8673-4604-9896-58494f87589e', 'authenticated', 'authenticated', '229103294.0e91f208@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:53.727508Z', '2026-02-06T23:38:53.727508Z', '2026-02-06T23:38:53.730775Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '873459be-a87c-4259-9e09-012e63cf877b', 'authenticated', 'authenticated', '223107956.68a00d31@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:52.808286Z', '2026-02-06T23:38:52.808286Z', '2026-02-06T23:38:52.811888Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '3a0a50d2-08a4-4ad7-bc0b-768170aa471b', 'authenticated', 'authenticated', '231858531.91d90284@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:51.868305Z', '2026-02-06T23:38:51.868305Z', '2026-02-06T23:38:51.872594Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '36641b78-98c8-44a4-986d-17501b8b0bcd', 'authenticated', 'authenticated', '217233716.65ce2b8a@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:50.946951Z', '2026-02-06T23:38:50.946951Z', '2026-02-06T23:38:50.951548Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b69802a6-2a32-4abb-b2d8-1e5b49004a01', 'authenticated', 'authenticated', '306424100.43f0916b@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:50.000926Z', '2026-02-06T23:38:50.000926Z', '2026-02-06T23:38:50.004945Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'aee38c7d-1243-4461-be66-1bf16d4473ac', 'authenticated', 'authenticated', '314624775.834c7559@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:49.063457Z', '2026-02-06T23:38:49.063457Z', '2026-02-06T23:38:49.06661Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e2f496ff-6caf-431f-bf0b-6bca17910f7e', 'authenticated', 'authenticated', '311217559.4e49e200@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:48.180971Z', '2026-02-06T23:38:48.180971Z', '2026-02-06T23:38:48.18734Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'd316371d-d739-4b1a-8d94-0dabeb5740bd', 'authenticated', 'authenticated', '300589999.d04729a3@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:47.166083Z', '2026-02-06T23:38:47.166083Z', '2026-02-06T23:38:47.169169Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '045b3540-2e22-40db-87f9-afad09496b87', 'authenticated', 'authenticated', '304978485.f98209db@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:46.282245Z', '2026-02-06T23:38:46.282245Z', '2026-02-06T23:38:46.285551Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a1797e61-b294-47d3-814c-45ca01c534b7', 'authenticated', 'authenticated', '704781182.49487476@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:45.250699Z', '2026-02-06T23:38:45.250699Z', '2026-02-06T23:38:45.254012Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '2656fae3-72b6-421d-bd0d-d828ab6ea786', 'authenticated', 'authenticated', '110591232.b257b57d@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:44.359866Z', '2026-02-06T23:38:44.359866Z', '2026-02-06T23:38:44.364445Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1087c38f-15f3-4419-a340-5d4908571c45', 'authenticated', 'authenticated', '232946060.e1abd7cc@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:43.424926Z', '2026-02-06T23:38:43.424926Z', '2026-02-06T23:38:43.427906Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '43f0f139-77de-4f3c-9122-8301d6bb1186', 'authenticated', 'authenticated', '254215017.13687945@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:42.525908Z', '2026-02-06T23:38:42.525908Z', '2026-02-06T23:38:42.529189Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ef128ae7-2434-4488-bc37-5840eae50652', 'authenticated', 'authenticated', '318618729.b6c42c12@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:41.65166Z', '2026-02-06T23:38:41.65166Z', '2026-02-06T23:38:41.655652Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b829798b-96c1-4c34-a078-a711dfd83e56', 'authenticated', 'authenticated', '307170730.e2cbdddf@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:40.770778Z', '2026-02-06T23:38:40.770778Z', '2026-02-06T23:38:40.773797Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ea0d6ef2-fe88-412e-9372-254fa96a9df0', 'authenticated', 'authenticated', '285558722.66bfb683@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:39.890421Z', '2026-02-06T23:38:39.890421Z', '2026-02-06T23:38:39.893479Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4e35817d-22f5-4aa3-a2a0-d919487690a1', 'authenticated', 'authenticated', '216436958.9dfc3b88@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:38.992893Z', '2026-02-06T23:38:38.992893Z', '2026-02-06T23:38:38.996002Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '34d302c3-d4e8-4e94-b0ee-a15c215cde85', 'authenticated', 'authenticated', '200935380.d1b604a7@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:38.05786Z', '2026-02-06T23:38:38.05786Z', '2026-02-06T23:38:38.061902Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'c2038c37-e956-43fc-bbe1-da31be9db8f9', 'authenticated', 'authenticated', '217338658.0f6161d8@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:37.169448Z', '2026-02-06T23:38:37.169448Z', '2026-02-06T23:38:37.172576Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '80be7edd-1d56-4597-a794-d1c27e69cbbf', 'authenticated', 'authenticated', '192202472.c0588374@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:36.263149Z', '2026-02-06T23:38:36.263149Z', '2026-02-06T23:38:36.266099Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '206b3e7c-f1bb-4f80-a90c-7c79e85f2501', 'authenticated', 'authenticated', '254072992.39e9d56d@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:35.369669Z', '2026-02-06T23:38:35.369669Z', '2026-02-06T23:38:35.372748Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'db72f646-c26d-487e-b41d-c1184f5d3b14', 'authenticated', 'authenticated', '216959454.f6fd15c3@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:34.476851Z', '2026-02-06T23:38:34.476851Z', '2026-02-06T23:38:34.481368Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '34d66094-3882-404a-98d0-262c1a19aad5', 'authenticated', 'authenticated', '232091803.2e055527@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:33.60266Z', '2026-02-06T23:38:33.60266Z', '2026-02-06T23:38:33.60565Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '84f65627-9e8b-4405-8f1d-21a8c4cdbfcb', 'authenticated', 'authenticated', '186785607.d30f868d@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:32.697201Z', '2026-02-06T23:38:32.697201Z', '2026-02-06T23:38:32.706707Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '8b523439-8977-45f9-8753-c50ea3e4b14f', 'authenticated', 'authenticated', '291689604.b03b18f7@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:31.819885Z', '2026-02-06T23:38:31.819885Z', '2026-02-06T23:38:31.822881Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '53fb6411-bec1-4e84-83f6-d214979f48b7', 'authenticated', 'authenticated', '194416534.0af3787c@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:30.935118Z', '2026-02-06T23:38:30.935118Z', '2026-02-06T23:38:30.93821Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '70c80fd5-3d33-47a8-b20f-2f88b0cea435', 'authenticated', 'authenticated', '258765747.9adb8878@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:30.057852Z', '2026-02-06T23:38:30.057852Z', '2026-02-06T23:38:30.06088Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'cdcdd003-ecdc-42b0-93b3-8ce7dcbfb48d', 'authenticated', 'authenticated', '146726189.499ab990@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:29.14914Z', '2026-02-06T23:38:29.14914Z', '2026-02-06T23:38:29.152385Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '58c04266-49ee-4c31-8197-a29b5f4414bf', 'authenticated', 'authenticated', '259767867.0932936d@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:28.230593Z', '2026-02-06T23:38:28.230593Z', '2026-02-06T23:38:28.235689Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '5b6ff594-0ab2-4090-9ba5-cc0aff685807', 'authenticated', 'authenticated', '216615100.b37903ee@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:27.348797Z', '2026-02-06T23:38:27.348797Z', '2026-02-06T23:38:27.353685Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'c7233b47-a531-450e-95c4-d4f9a298304a', 'authenticated', 'authenticated', '260100986.008a3c6a@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:26.412861Z', '2026-02-06T23:38:26.412861Z', '2026-02-06T23:38:26.418655Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7761dbe3-cc5d-4398-b244-964555b7184e', 'authenticated', 'authenticated', '224334522.1c1aff4e@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:25.522696Z', '2026-02-06T23:38:25.522696Z', '2026-02-06T23:38:25.52573Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1f485a85-bf84-43df-9c13-82e2d4c14f4a', 'authenticated', 'authenticated', '221578510.7edf9a6a@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:24.614547Z', '2026-02-06T23:38:24.614547Z', '2026-02-06T23:38:24.617596Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '2fd492ae-a853-4011-b628-33f14b9e505c', 'authenticated', 'authenticated', '217973167.77d401fc@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:23.587826Z', '2026-02-06T23:38:23.587826Z', '2026-02-06T23:38:23.590797Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '6d7e7e89-d133-4f02-8567-ee8d7f3c8e5c', 'authenticated', 'authenticated', '211616117.952acf96@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:22.671261Z', '2026-02-06T23:38:22.671261Z', '2026-02-06T23:38:22.674351Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ccbc2d96-f47d-4812-9e0a-fd1af41445a8', 'authenticated', 'authenticated', '288499441.bd7ad0dd@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:21.780024Z', '2026-02-06T23:38:21.780024Z', '2026-02-06T23:38:21.783168Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '73b075fe-4dc7-4f9f-aad7-6844429f5096', 'authenticated', 'authenticated', '257425349.c887e06c@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:20.876179Z', '2026-02-06T23:38:20.876179Z', '2026-02-06T23:38:20.881199Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '8c392c6d-fbb3-4e48-927c-52fb869d9165', 'authenticated', 'authenticated', '313383340.5b3dc51b@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:19.960067Z', '2026-02-06T23:38:19.960067Z', '2026-02-06T23:38:19.964396Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '3c77136d-c704-417a-adb2-1d1c5fd0fb11', 'authenticated', 'authenticated', '294347712.82ddf7ce@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:19.061424Z', '2026-02-06T23:38:19.061424Z', '2026-02-06T23:38:19.066346Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '8eaa94cc-16ee-46d2-b906-72cd155e7004', 'authenticated', 'authenticated', '195595610.ed552a0d@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:18.180749Z', '2026-02-06T23:38:18.180749Z', '2026-02-06T23:38:18.18504Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '135d7809-f2bc-429e-99dc-b8850998e468', 'authenticated', 'authenticated', '236652281.e239362a@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:17.277886Z', '2026-02-06T23:38:17.277886Z', '2026-02-06T23:38:17.283996Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b617b607-0be5-4e1f-863a-4c697a04cbe7', 'authenticated', 'authenticated', '260638684.88906a1d@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:16.374718Z', '2026-02-06T23:38:16.374718Z', '2026-02-06T23:38:16.377844Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '66223737-ce98-4d7b-b253-6dd34a9f840d', 'authenticated', 'authenticated', '303003502.a5b09e65@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:15.485807Z', '2026-02-06T23:38:15.485807Z', '2026-02-06T23:38:15.490629Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e41d025c-5208-4eeb-ae6c-2ae9f769c2ed', 'authenticated', 'authenticated', '242172296.83d4fb8b@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:14.585133Z', '2026-02-06T23:38:14.585133Z', '2026-02-06T23:38:14.589606Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a5848d49-1c10-493e-9a72-bbe00c5a3306', 'authenticated', 'authenticated', '153443480.8242d707@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:13.704589Z', '2026-02-06T23:38:13.704589Z', '2026-02-06T23:38:13.709045Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'bcdb4c7d-4cdc-4eef-ab1a-7b7765b43cd9', 'authenticated', 'authenticated', '241873592.78e56154@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:12.82237Z', '2026-02-06T23:38:12.82237Z', '2026-02-06T23:38:12.825558Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '93df29f1-8524-4d7b-8b2b-32de340b55ea', 'authenticated', 'authenticated', '228148456.63dfbb76@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:11.930466Z', '2026-02-06T23:38:11.930466Z', '2026-02-06T23:38:11.938457Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e9d817db-81e9-4e00-9dd9-be1b57ec0568', 'authenticated', 'authenticated', '287052940.a713dd97@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:11.015763Z', '2026-02-06T23:38:11.015763Z', '2026-02-06T23:38:11.019072Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'dca857fc-bd29-4cb5-b4de-19459ab2a467', 'authenticated', 'authenticated', '203261780.5d976717@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:10.078057Z', '2026-02-06T23:38:10.078057Z', '2026-02-06T23:38:10.081424Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'eac407b5-1ac6-4649-8650-72ad2a4964cc', 'authenticated', 'authenticated', '247845302.867a60a9@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:09.136612Z', '2026-02-06T23:38:09.136612Z', '2026-02-06T23:38:09.142543Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '39359e45-fc21-4b51-b454-58ebd4aa4fc3', 'authenticated', 'authenticated', '316124427.0aae1d39@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:08.256115Z', '2026-02-06T23:38:08.256115Z', '2026-02-06T23:38:08.259124Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0bbbadf5-7bcf-4a18-81c8-0e83e8e3e33e', 'authenticated', 'authenticated', '306961342.5ddba726@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:07.33651Z', '2026-02-06T23:38:07.33651Z', '2026-02-06T23:38:07.339779Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '6c3f8ef8-c018-4e91-bea1-474bfd167747', 'authenticated', 'authenticated', '265604850.2c34cd75@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:06.423673Z', '2026-02-06T23:38:06.423673Z', '2026-02-06T23:38:06.428706Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '8186f567-6a86-41e8-9e3a-2677b693adcb', 'authenticated', 'authenticated', '900425830.08cd78a8@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:05.520334Z', '2026-02-06T23:38:05.520334Z', '2026-02-06T23:38:05.524087Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'c5f02ca5-eb8e-46f2-bef5-b11e81a1e258', 'authenticated', 'authenticated', '152808299.9adc059d@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:04.617667Z', '2026-02-06T23:38:04.617667Z', '2026-02-06T23:38:04.622407Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '82098b17-1865-4a02-8b10-db46036fdd6a', 'authenticated', 'authenticated', '256802378.f862e9c4@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:03.717777Z', '2026-02-06T23:38:03.717777Z', '2026-02-06T23:38:03.725318Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b6102ab3-8043-4788-a279-42ab1bad19b4', 'authenticated', 'authenticated', '137800347.e3839595@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:02.774038Z', '2026-02-06T23:38:02.774038Z', '2026-02-06T23:38:02.781873Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '61e8d983-6508-4e34-955c-65fb5543b11f', 'authenticated', 'authenticated', '706583710.f963b80a@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:01.875635Z', '2026-02-06T23:38:01.875635Z', '2026-02-06T23:38:01.885395Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '858b2fbc-5f02-4423-bee2-e3691a7c8118', 'authenticated', 'authenticated', '118493035.271852e4@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:00.972232Z', '2026-02-06T23:38:00.972232Z', '2026-02-06T23:38:00.982829Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '9857e74d-2298-4efd-9749-d1614ca91077', 'authenticated', 'authenticated', '179672436.f21ced5c@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:38:00.043796Z', '2026-02-06T23:38:00.043796Z', '2026-02-06T23:38:00.056753Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '75f58ec4-e22f-43d9-80d4-4d4c485d45c0', 'authenticated', 'authenticated', '145285073.ea8e84a3@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-06T23:37:59.037599Z', '2026-02-06T23:37:59.037599Z', '2026-02-06T23:37:59.093094Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '2092910d-68f9-4b5c-b899-00a114bb4d82', 'authenticated', 'authenticated', 'jingloria777@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:49:01.838287Z', '2026-02-05T15:49:01.838287Z', '2026-02-05T15:49:02.435505Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'c1a0736e-8168-4d9e-bc75-8d6b08db70c4', 'authenticated', 'authenticated', 'per@panamera-search.no', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:49:00.600462Z', '2026-02-05T15:49:00.600462Z', '2026-02-05T15:49:01.187521Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '023ffdff-23f3-4fd0-bdab-b11c48b9eba3', 'authenticated', 'authenticated', 'gilvanbispo30@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:59.341552Z', '2026-02-05T15:48:59.341552Z', '2026-02-05T15:48:59.942014Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'bae86140-4ed9-4561-b856-40e300053ca3', 'authenticated', 'authenticated', 'associacao@anjoscompatinhas.org', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:57.248371Z', '2026-02-05T15:48:57.248371Z', '2026-02-05T15:48:58.566222Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '9039d4fa-fd21-4652-b395-4f7d77c195da', 'authenticated', 'authenticated', 'miguel.antao.caad@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:56.063667Z', '2026-02-05T15:48:56.063667Z', '2026-02-05T15:48:56.643717Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7dabc8b5-7890-4647-807a-1655621df663', 'authenticated', 'authenticated', 'stephenknapp85@hotmail.co.uk', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:54.759472Z', '2026-02-05T15:48:54.759472Z', '2026-02-05T15:48:55.369526Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a6d88cc0-338d-4eb9-a98a-5b3673777b05', 'authenticated', 'authenticated', 'maria.campinas@4allsolutions.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:53.56918Z', '2026-02-05T15:48:53.56918Z', '2026-02-05T15:48:54.177982Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'bed9edbe-b3d0-47bd-9644-3351ba41a19b', 'authenticated', 'authenticated', 'j.cunhacosta@kwportugal.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:52.246649Z', '2026-02-05T15:48:52.246649Z', '2026-02-05T15:48:52.843418Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '5169c388-9670-4626-9ab6-63279df304cc', 'authenticated', 'authenticated', 'joaopedrofeliciano@protonmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:51.066076Z', '2026-02-05T15:48:51.066076Z', '2026-02-05T15:48:51.666496Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1a516f71-ebd3-43fc-bee5-e3eb900b098a', 'authenticated', 'authenticated', 'tiago-santos98@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:49.803183Z', '2026-02-05T15:48:49.803183Z', '2026-02-05T15:48:50.399259Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '05c816d4-5b14-4bcd-804a-0f829fe525c7', 'authenticated', 'authenticated', 'andrew@configurahomes.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:48.620102Z', '2026-02-05T15:48:48.620102Z', '2026-02-05T15:48:49.236694Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '54990e6c-aa18-461c-bd11-30b0382c788a', 'authenticated', 'authenticated', 'e.wickert@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:47.449198Z', '2026-02-05T15:48:47.449198Z', '2026-02-05T15:48:48.046467Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '379ad263-eec8-4d34-9f0a-81902f0d0770', 'authenticated', 'authenticated', 'joseluisbarbajosa@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:46.069383Z', '2026-02-05T15:48:46.069383Z', '2026-02-05T15:48:46.654039Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '402e74f2-71dc-4a74-bbb9-d685920985da', 'authenticated', 'authenticated', 'laravanuch@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:44.868443Z', '2026-02-05T15:48:44.868443Z', '2026-02-05T15:48:45.463661Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0d146dce-1a3b-41f4-bcc0-98f7dc78f813', 'authenticated', 'authenticated', '501379550.ml9msnsp@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:43.682197Z', '2026-02-05T15:48:43.682197Z', '2026-02-05T15:48:44.268181Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'd5fb788f-2031-496f-9524-c9f53e45cb94', 'authenticated', 'authenticated', 'lilianapssantos@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:42.517778Z', '2026-02-05T15:48:42.517778Z', '2026-02-05T15:48:43.120673Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4dd2baae-4619-46ae-b2ef-29bb912d86f8', 'authenticated', 'authenticated', 'naomcareca@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:41.309174Z', '2026-02-05T15:48:41.309174Z', '2026-02-05T15:48:41.912126Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '04bc901b-635b-4ff6-957d-e92e03ec18e8', 'authenticated', 'authenticated', 'marina.praxedes@planeia.net', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:39.924667Z', '2026-02-05T15:48:39.924667Z', '2026-02-05T15:48:40.518663Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1d3701fb-abaf-42f1-806a-d961779ea154', 'authenticated', 'authenticated', 'adriana@lisbonwinery.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:38.092612Z', '2026-02-05T15:48:38.092612Z', '2026-02-05T15:48:38.684571Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b4639535-c8f2-4042-aedd-7b61b61d61aa', 'authenticated', 'authenticated', 'adriana@yourfriendinlisbon.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:36.856744Z', '2026-02-05T15:48:36.856744Z', '2026-02-05T15:48:37.473817Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '16cb4202-c349-4d0d-ac31-bfa9a2c0f093', 'authenticated', 'authenticated', 'oliveira.dias@oliveiradias.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:35.687886Z', '2026-02-05T15:48:35.687886Z', '2026-02-05T15:48:36.294015Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b2eea76a-e2a7-4a92-b139-a76fde78812b', 'authenticated', 'authenticated', 'ramalhetedatributos@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:34.132286Z', '2026-02-05T15:48:34.132286Z', '2026-02-05T15:48:34.733196Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '47c73af8-a9ec-45c5-90d7-fead0f04e6de', 'authenticated', 'authenticated', 'antonioalexandrerpereira@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:32.94679Z', '2026-02-05T15:48:32.94679Z', '2026-02-05T15:48:33.55876Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '038bb495-30c3-45f0-bb88-99969c561437', 'authenticated', 'authenticated', 'sarafreitas201@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:31.68069Z', '2026-02-05T15:48:31.68069Z', '2026-02-05T15:48:32.278654Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '48626649-5237-4052-836e-85edd49f21cd', 'authenticated', 'authenticated', 'david@planeia.net', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:30.334137Z', '2026-02-05T15:48:30.334137Z', '2026-02-05T15:48:30.938413Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4d690a87-9213-4276-b85f-9fe0007f908b', 'authenticated', 'authenticated', 'pedro@xmix.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:28.82805Z', '2026-02-05T15:48:28.82805Z', '2026-02-05T15:48:29.435987Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'af07b545-c6a4-4572-b4ed-3249eef19017', 'authenticated', 'authenticated', 'geral.akfch@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:27.548814Z', '2026-02-05T15:48:27.548814Z', '2026-02-05T15:48:28.171555Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '6419538e-ca40-4984-a1f9-773b5cc70f2e', 'authenticated', 'authenticated', 'casasdapaula@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:26.397485Z', '2026-02-05T15:48:26.397485Z', '2026-02-05T15:48:26.99892Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'f811b662-55de-43ba-bd28-e5fc904c357a', 'authenticated', 'authenticated', 'beautydreamfit@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:25.174962Z', '2026-02-05T15:48:25.174962Z', '2026-02-05T15:48:25.764636Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '308c51f1-5508-49f1-a24d-1f4b4e98210f', 'authenticated', 'authenticated', 'elementoconvincente@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:24.039872Z', '2026-02-05T15:48:24.039872Z', '2026-02-05T15:48:24.636981Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'eaec372f-d63e-497c-8c94-746d25d92d46', 'authenticated', 'authenticated', 'brigida.apolonia@stoa.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:22.690036Z', '2026-02-05T15:48:22.690036Z', '2026-02-05T15:48:23.306596Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'fde5542f-c970-420e-b804-be775e96a1e6', 'authenticated', 'authenticated', 'victor30isabel@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:21.327749Z', '2026-02-05T15:48:21.327749Z', '2026-02-05T15:48:21.938046Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e7b01925-3602-4e06-99ac-13fbe2a15922', 'authenticated', 'authenticated', 'projetonaterra@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:19.4534Z', '2026-02-05T15:48:19.4534Z', '2026-02-05T15:48:20.054161Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'c61456c5-4361-413c-a433-f2ebe443a309', 'authenticated', 'authenticated', 'msouaihi11@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:17.945737Z', '2026-02-05T15:48:17.945737Z', '2026-02-05T15:48:18.541322Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1ac2bf90-3bbc-4b99-b646-eb33630e7197', 'authenticated', 'authenticated', 'gamarustica@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:16.588568Z', '2026-02-05T15:48:16.588568Z', '2026-02-05T15:48:17.178451Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '3bd7afa7-dd3f-45a2-b808-357a42d530f3', 'authenticated', 'authenticated', 'prowoodserv@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:15.332553Z', '2026-02-05T15:48:15.332553Z', '2026-02-05T15:48:15.926066Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ae72201a-2a71-4415-942a-7d74711dd9cb', 'authenticated', 'authenticated', 'olianp2006@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:14.068291Z', '2026-02-05T15:48:14.068291Z', '2026-02-05T15:48:14.679548Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '21542048-7ae4-44ac-9a30-687cb6a74659', 'authenticated', 'authenticated', 'sarasemedo.clinicapsicoterapia@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:12.800844Z', '2026-02-05T15:48:12.800844Z', '2026-02-05T15:48:13.404358Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '93954ce7-0f00-4a13-844f-f5c58ee174ec', 'authenticated', 'authenticated', 'gimenezes0409@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:11.574579Z', '2026-02-05T15:48:11.574579Z', '2026-02-05T15:48:12.172302Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7e184fd5-3b59-4a8b-bc38-4f30ee0b5806', 'authenticated', 'authenticated', 'electroeleva.geral@sapo.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:09.985921Z', '2026-02-05T15:48:09.985921Z', '2026-02-05T15:48:10.59761Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b76f2812-2c81-49b1-a695-db7c4957271c', 'authenticated', 'authenticated', 'harm@sparqly.ai', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:08.756354Z', '2026-02-05T15:48:08.756354Z', '2026-02-05T15:48:09.355554Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '9ac582fe-8b0d-4425-9767-ed2e0860a01e', 'authenticated', 'authenticated', 'tjjrm.geral@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:07.197967Z', '2026-02-05T15:48:07.197967Z', '2026-02-05T15:48:07.805931Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7fd1ab88-e70a-4ade-b53d-da2084d65d5b', 'authenticated', 'authenticated', 'eloquente.esfera@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:05.86702Z', '2026-02-05T15:48:05.86702Z', '2026-02-05T15:48:06.463705Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '3771f682-8b04-47f2-9491-c99ccf71bf14', 'authenticated', 'authenticated', 'paula.moura@obrasnascasas.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:04.54756Z', '2026-02-05T15:48:04.54756Z', '2026-02-05T15:48:05.137801Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e1178e46-e6d2-46e2-914f-59af9ed8c6ea', 'authenticated', 'authenticated', 'nuno@nqa.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:03.349477Z', '2026-02-05T15:48:03.349477Z', '2026-02-05T15:48:03.941594Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '222bc21b-4419-4c5e-a06c-61fd9c5701d7', 'authenticated', 'authenticated', 'paa13801@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:48:02.125069Z', '2026-02-05T15:48:02.125069Z', '2026-02-05T15:48:02.720681Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '6aafbc51-af35-4de5-a38e-7ba73672c653', 'authenticated', 'authenticated', 'camilla.matos@aureaphygital.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:59.824202Z', '2026-02-05T15:47:59.824202Z', '2026-02-05T15:48:00.40539Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'bdc4e85c-2602-4351-b94a-e8bb53cfc62f', 'authenticated', 'authenticated', 'al@epicweb3.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:58.482175Z', '2026-02-05T15:47:58.482175Z', '2026-02-05T15:47:59.083138Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'df307ac4-50c2-4cd0-afb0-c6b628490cae', 'authenticated', 'authenticated', 'marcia.rosa@mmr.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:57.197319Z', '2026-02-05T15:47:57.197319Z', '2026-02-05T15:47:57.778667Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ba7c2fc6-278b-485c-89bb-07bd6d80992e', 'authenticated', 'authenticated', 'brilhantentusiasmo@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:56.024713Z', '2026-02-05T15:47:56.024713Z', '2026-02-05T15:47:56.617492Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b0d5457f-d769-492d-a12a-2187206bf86b', 'authenticated', 'authenticated', 'fernando.sousa@drylandagroforestry.org', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:54.856979Z', '2026-02-05T15:47:54.856979Z', '2026-02-05T15:47:55.445393Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b6cd7613-85b0-48c9-bbc1-a01ac3974eee', 'authenticated', 'authenticated', 'pct.contabilidade@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:53.679882Z', '2026-02-05T15:47:53.679882Z', '2026-02-05T15:47:54.263756Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '31ea3edc-6d41-4733-9fa9-8ad5393b018d', 'authenticated', 'authenticated', 'pt.accounting@fixar.pro', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:52.297718Z', '2026-02-05T15:47:52.297718Z', '2026-02-05T15:47:52.873023Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '9c7a07d4-9a0b-49cd-a0f9-4eb7512a3627', 'authenticated', 'authenticated', 'aplausoregular@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:50.860982Z', '2026-02-05T15:47:50.860982Z', '2026-02-05T15:47:51.443009Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0f10189d-3c2c-4b44-b030-14439e477f46', 'authenticated', 'authenticated', 'franciscodefreitas@natlor.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:49.501784Z', '2026-02-05T15:47:49.501784Z', '2026-02-05T15:47:50.087865Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7818b64c-2ebe-4aaf-a7bc-95c355a226ec', 'authenticated', 'authenticated', 'alexandre.elias@higipackaging.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:48.163565Z', '2026-02-05T15:47:48.163565Z', '2026-02-05T15:47:48.741021Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '74d70bd5-7ecf-488b-814a-1c00a13dd061', 'authenticated', 'authenticated', 'thomas@stark-partners.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:46.881226Z', '2026-02-05T15:47:46.881226Z', '2026-02-05T15:47:47.4751Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '8d99c39c-8907-498a-b4d1-b1c9f037dbc3', 'authenticated', 'authenticated', 'paschoal.andrea@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:45.472429Z', '2026-02-05T15:47:45.472429Z', '2026-02-05T15:47:46.067815Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'c1dec22c-3aae-46b3-b872-e4e3eb41548f', 'authenticated', 'authenticated', 'remotofugaz@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:43.973461Z', '2026-02-05T15:47:43.973461Z', '2026-02-05T15:47:44.580554Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e71c1d2b-76f0-480b-a57e-ed058106c2eb', 'authenticated', 'authenticated', 'bemditopaladar@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:42.604447Z', '2026-02-05T15:47:42.604447Z', '2026-02-05T15:47:43.183661Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'bf0489c2-a8d0-4286-bbfe-b6dce37701ad', 'authenticated', 'authenticated', 'aitor.z@zubeldiacapital.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:41.179941Z', '2026-02-05T15:47:41.179941Z', '2026-02-05T15:47:41.761232Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a82bab20-47d6-4444-8939-7c78cd49f82f', 'authenticated', 'authenticated', 'wisebreezelda@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:39.725341Z', '2026-02-05T15:47:39.725341Z', '2026-02-05T15:47:40.316945Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'd367f2d7-2dfc-4630-901f-7957859a48b0', 'authenticated', 'authenticated', 'office@nqa.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:38.443179Z', '2026-02-05T15:47:38.443179Z', '2026-02-05T15:47:39.030357Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7779b8e9-debb-4987-8bea-7519a04f65f0', 'authenticated', 'authenticated', 'speedshop.pt@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:37.381794Z', '2026-02-05T15:47:37.381794Z', '2026-02-05T15:47:37.955627Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'bc4f1586-844f-4ae9-ac6a-8a6793f70531', 'authenticated', 'authenticated', 'alexandra.quintans@bdseguros.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:36.191379Z', '2026-02-05T15:47:36.191379Z', '2026-02-05T15:47:36.780657Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '5480f044-95f7-4f54-8333-479e93f476f1', 'authenticated', 'authenticated', 'brunoferreira@positivedrive.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:34.831485Z', '2026-02-05T15:47:34.831485Z', '2026-02-05T15:47:35.428884Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '446f5d27-2058-4362-a4f3-1d2f88158a2c', 'authenticated', 'authenticated', 'camelialoja@outlook.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:33.28832Z', '2026-02-05T15:47:33.28832Z', '2026-02-05T15:47:33.88078Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '42fccbd0-105b-4289-9d54-263f651449bd', 'authenticated', 'authenticated', 'sofiamariapnunes@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:15.846228Z', '2026-02-05T15:47:15.846228Z', '2026-02-05T15:47:16.424622Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'fb111a60-41fb-4705-bfe7-7cc1c5062653', 'authenticated', 'authenticated', '129097390.ml9mqmc3@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:08.456235Z', '2026-02-05T15:47:08.456235Z', '2026-02-05T15:47:09.051115Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '50c11105-9350-4c9f-80b6-b6c5d7a168d1', 'authenticated', 'authenticated', 'tesouraria@venexos.org', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:07.188851Z', '2026-02-05T15:47:07.188851Z', '2026-02-05T15:47:07.778841Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ce3512e0-3a4d-4e5c-afda-09e1b264ecd2', 'authenticated', 'authenticated', 'keybusinesssupport@key.fm', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:05.139234Z', '2026-02-05T15:47:05.139234Z', '2026-02-05T15:47:05.7354Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7e129199-3d35-49ca-a70b-a25d57d3af4e', 'authenticated', 'authenticated', 'administracao@puberia.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:47:03.612906Z', '2026-02-05T15:47:03.612906Z', '2026-02-05T15:47:04.212814Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'aedf3873-ad0e-439f-a444-62407604ae86', 'authenticated', 'authenticated', 'gestao@amariafaz.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:43.901819Z', '2026-02-05T15:42:43.901819Z', '2026-02-05T15:42:44.491017Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '79d3464b-0a4b-474d-aaf6-2bd0c1067362', 'authenticated', 'authenticated', 'office.cp@4allsolutions.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:42.509959Z', '2026-02-05T15:42:42.509959Z', '2026-02-05T15:42:43.118605Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '9c00fbe6-c305-4d20-8c8d-0fffaa703838', 'authenticated', 'authenticated', 'office.av@4allsolutions.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:41.220626Z', '2026-02-05T15:42:41.220626Z', '2026-02-05T15:42:41.809395Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '3fdbf308-7b6f-4e97-8c4a-bc7ddeb80e19', 'authenticated', 'authenticated', 'econocopy1@sapo.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:39.744521Z', '2026-02-05T15:42:39.744521Z', '2026-02-05T15:42:40.347549Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '63f1cdd1-4179-4240-9c6f-320d22c9be0f', 'authenticated', 'authenticated', 'office.sa@4allsolutions.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:38.431155Z', '2026-02-05T15:42:38.431155Z', '2026-02-05T15:42:39.033667Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '51b06d12-7662-4aa2-846b-bf3ffda73846', 'authenticated', 'authenticated', 'office@4allsolutions.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:36.945154Z', '2026-02-05T15:42:36.945154Z', '2026-02-05T15:42:37.563917Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b0d45c9d-12ba-4353-af70-8292c9a09ce0', 'authenticated', 'authenticated', 'fernando.gferreira@outlook.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:34.767238Z', '2026-02-05T15:42:34.767238Z', '2026-02-05T15:42:35.362979Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0ff76128-e8d9-4d5a-9caa-34a3ce0d9d74', 'authenticated', 'authenticated', 'geral@aptmd.org', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:33.38044Z', '2026-02-05T15:42:33.38044Z', '2026-02-05T15:42:33.978642Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1135d3b1-d7da-43cc-b9b5-a23dabc675af', 'authenticated', 'authenticated', 'asafevieira@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:31.835765Z', '2026-02-05T15:42:31.835765Z', '2026-02-05T15:42:32.440918Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0066dce0-b0a9-457c-8d74-76646f5ddc57', 'authenticated', 'authenticated', 'info@grey-marine.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:30.459241Z', '2026-02-05T15:42:30.459241Z', '2026-02-05T15:42:31.055409Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'acd7e412-6d76-4bdb-a982-2ebe4872fef7', 'authenticated', 'authenticated', 'dan.dubiner@dubiluxcondo.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:28.436626Z', '2026-02-05T15:42:28.436626Z', '2026-02-05T15:42:29.034124Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '761f2178-9e75-4168-b81b-0b2367cbd106', 'authenticated', 'authenticated', 'jessicasmelocruz@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:26.987899Z', '2026-02-05T15:42:26.987899Z', '2026-02-05T15:42:27.571392Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1c5d2f7a-58ad-4109-8085-c5234b03fcb7', 'authenticated', 'authenticated', 'brigadoce.portugal@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:25.679006Z', '2026-02-05T15:42:25.679006Z', '2026-02-05T15:42:26.272811Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '995df7af-40e8-4137-bc5e-27d7e74e42cb', 'authenticated', 'authenticated', 'sofiamirandapsicologia@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:24.415942Z', '2026-02-05T15:42:24.415942Z', '2026-02-05T15:42:25.012051Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ecdfe078-ba5e-4a9e-8044-0be50fb34b12', 'authenticated', 'authenticated', 'hestrela@hpgti.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:23.109854Z', '2026-02-05T15:42:23.109854Z', '2026-02-05T15:42:23.715759Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0a6c7e66-4285-4821-b8e9-f12ce3211cb4', 'authenticated', 'authenticated', 'caixilharialra@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:21.725851Z', '2026-02-05T15:42:21.725851Z', '2026-02-05T15:42:22.320421Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '947b3547-5303-4733-95a4-1773e3b77c73', 'authenticated', 'authenticated', 'hestrela@nexusgen.eu', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:20.38859Z', '2026-02-05T15:42:20.38859Z', '2026-02-05T15:42:21.004096Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '937dfd37-6e2b-4fe6-a9ca-2f62ec639dc8', 'authenticated', 'authenticated', '516965476@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:18.381204Z', '2026-02-05T15:42:18.381204Z', '2026-02-05T15:42:18.980132Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '6a1966b1-6fa6-4f0c-b558-adf40007f047', 'authenticated', 'authenticated', 'info@mrisac.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:17.087843Z', '2026-02-05T15:42:17.087843Z', '2026-02-05T15:42:17.682188Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '2564d2e5-7e4f-4781-b3b0-252cc5f562bf', 'authenticated', 'authenticated', 'theceo@thecorpcorporation.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:15.767933Z', '2026-02-05T15:42:15.767933Z', '2026-02-05T15:42:16.361144Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'aeb977df-27aa-4052-b0a9-dabb49470c3e', 'authenticated', 'authenticated', 'yurisoares@icloud.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:14.504667Z', '2026-02-05T15:42:14.504667Z', '2026-02-05T15:42:15.096861Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'fd1bf8b0-12ea-4fd4-addb-fe338568f8c4', 'authenticated', 'authenticated', 'accounting@delta-pharma.eu', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:12.740719Z', '2026-02-05T15:42:12.740719Z', '2026-02-05T15:42:13.503399Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '9a5555e1-2819-4f47-a2ea-f32ffcdc088c', 'authenticated', 'authenticated', 'hbergsma@togetherforthebettergood.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:11.133705Z', '2026-02-05T15:42:11.133705Z', '2026-02-05T15:42:11.746297Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'fe199e75-09d2-4b18-a1e9-9580a56bc523', 'authenticated', 'authenticated', 'svblopes@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:09.670694Z', '2026-02-05T15:42:09.670694Z', '2026-02-05T15:42:10.270461Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '120ec7ae-9a0b-43bb-b8ea-5ef19640ee74', 'authenticated', 'authenticated', 'contato@clubemulheresdenegociospt.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:08.193479Z', '2026-02-05T15:42:08.193479Z', '2026-02-05T15:42:08.812579Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a5c27266-4d53-449d-90c6-67bcd248bae6', 'authenticated', 'authenticated', 'pkeast@camplify.com.au', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:06.837641Z', '2026-02-05T15:42:06.837641Z', '2026-02-05T15:42:07.449574Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '45a92e25-fd50-4b25-a134-c1d577812fe5', 'authenticated', 'authenticated', 'zaid.shomali@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:05.412375Z', '2026-02-05T15:42:05.412375Z', '2026-02-05T15:42:06.000842Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ce0061b1-e29a-4050-9cea-7490e3edb5b0', 'authenticated', 'authenticated', 'carlaplacidoseguros@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:04.038312Z', '2026-02-05T15:42:04.038312Z', '2026-02-05T15:42:04.652886Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1b02c5be-e2fe-4d60-8cd6-9c567411b01f', 'authenticated', 'authenticated', '517544911@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:42:02.597754Z', '2026-02-05T15:42:02.597754Z', '2026-02-05T15:42:03.239448Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4129f693-9716-485d-bbe4-d51dfac4eef3', 'authenticated', 'authenticated', 'mgemy1998@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:59.516437Z', '2026-02-05T15:41:59.516437Z', '2026-02-05T15:42:00.133027Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '2ba09fa8-bcef-4fdf-bae9-ba62c82c2d62', 'authenticated', 'authenticated', 'letrasrevoltas@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:58.109772Z', '2026-02-05T15:41:58.109772Z', '2026-02-05T15:41:58.698507Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '634d1138-618a-45a0-abdd-cd6fdbc810fa', 'authenticated', 'authenticated', 'angunn2009@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:56.895166Z', '2026-02-05T15:41:56.895166Z', '2026-02-05T15:41:57.494174Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b5c7e884-33db-4b47-a09e-f8c57f6dba2b', 'authenticated', 'authenticated', 'geral.simmper@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:55.60114Z', '2026-02-05T15:41:55.60114Z', '2026-02-05T15:41:56.234473Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4bc12560-a9bd-4c75-85db-55073c9821cd', 'authenticated', 'authenticated', 'saspb13.hotmail.com@icloud.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:54.341247Z', '2026-02-05T15:41:54.341247Z', '2026-02-05T15:41:54.935058Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4f7ab0ed-ae1f-4ac0-a1c7-e36133849bba', 'authenticated', 'authenticated', 'philipp.kalb@mangotext.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:53.117337Z', '2026-02-05T15:41:53.117337Z', '2026-02-05T15:41:53.701408Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'f35a9b4f-6a1e-4c51-a6f3-c7b664d11e73', 'authenticated', 'authenticated', 'receitascasuaispastelaria@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:51.814003Z', '2026-02-05T15:41:51.814003Z', '2026-02-05T15:41:52.393703Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '72e44604-9226-4dfe-bf27-358f389a1596', 'authenticated', 'authenticated', 'financeiro@revolutionprofessional.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:50.457312Z', '2026-02-05T15:41:50.457312Z', '2026-02-05T15:41:51.048534Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b008959c-8afc-4835-9b1b-f785eb3aecb7', 'authenticated', 'authenticated', 'sukhdeepbatth93@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:49.054042Z', '2026-02-05T15:41:49.054042Z', '2026-02-05T15:41:49.654227Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ad263f0c-cd8d-4e9a-80bc-ea4df4581314', 'authenticated', 'authenticated', 'rotunda.infinita@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:47.806722Z', '2026-02-05T15:41:47.806722Z', '2026-02-05T15:41:48.396351Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e9a4f57d-a3f5-4154-83f6-33ae52cdc26a', 'authenticated', 'authenticated', 'barbaratorresmonteiro@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:46.5678Z', '2026-02-05T15:41:46.5678Z', '2026-02-05T15:41:47.148162Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '2348465c-21f3-4542-ae39-364deca80312', 'authenticated', 'authenticated', 'nuno.diz@certifiltra.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:45.283134Z', '2026-02-05T15:41:45.283134Z', '2026-02-05T15:41:45.862896Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4988e851-24ec-4c9e-908d-014a738039d1', 'authenticated', 'authenticated', 'joaogondar@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:43.898303Z', '2026-02-05T15:41:43.898303Z', '2026-02-05T15:41:44.485045Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '15f58d47-e51d-4a9b-8295-479dd0b251b5', 'authenticated', 'authenticated', 'associacao.imani@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:42.580078Z', '2026-02-05T15:41:42.580078Z', '2026-02-05T15:41:43.172574Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '14a6db46-1efb-437d-b95a-862d9291d3c7', 'authenticated', 'authenticated', 'thirty.nine.pilots@outlook.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:41.192193Z', '2026-02-05T15:41:41.192193Z', '2026-02-05T15:41:41.780001Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'd635dc18-8321-4f82-bc89-0da10b88aa8f', 'authenticated', 'authenticated', 'hello@serravida.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:39.898714Z', '2026-02-05T15:41:39.898714Z', '2026-02-05T15:41:40.480541Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '3f062f01-7599-4c79-bf87-eab3cda2c726', 'authenticated', 'authenticated', 'ola@tiffinlisboa.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:38.631364Z', '2026-02-05T15:41:38.631364Z', '2026-02-05T15:41:39.205334Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e23f6f9e-9167-4670-8d4d-c99affa68f08', 'authenticated', 'authenticated', 'mar.interiors@outlook.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:37.339425Z', '2026-02-05T15:41:37.339425Z', '2026-02-05T15:41:37.92556Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7d9284f7-f9f4-446c-bc4a-e7b288387c62', 'authenticated', 'authenticated', 'pauwels-a@outlook.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:35.853013Z', '2026-02-05T15:41:35.853013Z', '2026-02-05T15:41:36.508672Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '30955390-6508-4885-9c00-7593dc164534', 'authenticated', 'authenticated', 'proezasnumericas@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:34.550301Z', '2026-02-05T15:41:34.550301Z', '2026-02-05T15:41:35.150801Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '07c597e1-dd72-498a-a6a8-6b0d082c5481', 'authenticated', 'authenticated', '517232065@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:33.239065Z', '2026-02-05T15:41:33.239065Z', '2026-02-05T15:41:33.82356Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '50bd957b-4f34-4b6c-bf2f-239c724102de', 'authenticated', 'authenticated', 'xiradance@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:31.846619Z', '2026-02-05T15:41:31.846619Z', '2026-02-05T15:41:32.459262Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'f14dcf73-f724-461e-a650-685e68a68d13', 'authenticated', 'authenticated', '517154447@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:30.400489Z', '2026-02-05T15:41:30.400489Z', '2026-02-05T15:41:30.98742Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '2497782e-0b59-4032-8109-b8a13110ff62', 'authenticated', 'authenticated', 'ryan@haveyouheard.co.za', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:29.099419Z', '2026-02-05T15:41:29.099419Z', '2026-02-05T15:41:29.679466Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '8b0e0e93-fcd1-4f5b-adc5-4c2b769e3505', 'authenticated', 'authenticated', 'msalles@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:27.640204Z', '2026-02-05T15:41:27.640204Z', '2026-02-05T15:41:28.216014Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '152ee00f-269d-49d4-b1db-9da0dd7bd65d', 'authenticated', 'authenticated', 'joana.marcal@circledimension.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:26.373373Z', '2026-02-05T15:41:26.373373Z', '2026-02-05T15:41:26.953157Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '71e2d882-2505-4842-a9fa-6dabbb037916', 'authenticated', 'authenticated', 'gloriousinitiative@yahoo.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:24.943132Z', '2026-02-05T15:41:24.943132Z', '2026-02-05T15:41:25.536104Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1b38d037-4638-4dac-b82c-501967babf8f', 'authenticated', 'authenticated', '308743547@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:23.54712Z', '2026-02-05T15:41:23.54712Z', '2026-02-05T15:41:24.145759Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '80779ceb-430d-4cad-9285-b746eb22df70', 'authenticated', 'authenticated', 'vital@pleeco.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:22.195099Z', '2026-02-05T15:41:22.195099Z', '2026-02-05T15:41:22.77967Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '924de894-b660-433b-90db-31066f928883', 'authenticated', 'authenticated', 'pedro.pesquisalinear@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:20.85403Z', '2026-02-05T15:41:20.85403Z', '2026-02-05T15:41:21.43711Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e3455b40-264c-44f6-9c14-dda9a6a185b3', 'authenticated', 'authenticated', 'di9260010823@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:19.468955Z', '2026-02-05T15:41:19.468955Z', '2026-02-05T15:41:20.047666Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7273768e-3146-430f-b746-05ac3bc221ab', 'authenticated', 'authenticated', 'powersolutions4u.ltd@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:18.202683Z', '2026-02-05T15:41:18.202683Z', '2026-02-05T15:41:18.788929Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '54fd3b48-9358-42ce-a991-738561783b7a', 'authenticated', 'authenticated', 'arturjbfonseca@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:16.815538Z', '2026-02-05T15:41:16.815538Z', '2026-02-05T15:41:17.413569Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '12d0c20f-8b66-4731-bfc0-4744df89a66e', 'authenticated', 'authenticated', 'facingtactics@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:15.476198Z', '2026-02-05T15:41:15.476198Z', '2026-02-05T15:41:16.065999Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '9cbd195b-a8ad-463b-b1ba-b80c5e3bbb34', 'authenticated', 'authenticated', 'edite28@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:14.132401Z', '2026-02-05T15:41:14.132401Z', '2026-02-05T15:41:14.728175Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '36a7d871-38dc-4b28-8385-92baa6524d22', 'authenticated', 'authenticated', 'distanciafacultativa@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:12.796791Z', '2026-02-05T15:41:12.796791Z', '2026-02-05T15:41:13.3842Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a32b86ae-d30a-4222-ae4f-5bbc57c93fc9', 'authenticated', 'authenticated', 'edgar.peguicha@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:11.439607Z', '2026-02-05T15:41:11.439607Z', '2026-02-05T15:41:12.048565Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'bc82a54d-f723-4956-9ddc-b480711c9cd3', 'authenticated', 'authenticated', 'vanessa@firstsmile-photography.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:10.109612Z', '2026-02-05T15:41:10.109612Z', '2026-02-05T15:41:10.713073Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '34e21df0-96c9-4915-abf9-d010068fc047', 'authenticated', 'authenticated', 'casadamarinha2@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:08.744804Z', '2026-02-05T15:41:08.744804Z', '2026-02-05T15:41:09.350615Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ae8e7473-4c2e-4c51-92a2-881731cf65b0', 'authenticated', 'authenticated', 'calmtrip@outlook.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:07.310912Z', '2026-02-05T15:41:07.310912Z', '2026-02-05T15:41:07.910491Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'bc2f1d89-e139-44a2-be89-ea76a918cbb8', 'authenticated', 'authenticated', 'igomesdsi@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:06.0116Z', '2026-02-05T15:41:06.0116Z', '2026-02-05T15:41:06.608468Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '11a1b086-90fd-4183-8875-b7a2f9c40561', 'authenticated', 'authenticated', 'nserafim@netcabo.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:04.754367Z', '2026-02-05T15:41:04.754367Z', '2026-02-05T15:41:05.350088Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7e7dcb62-25d2-45ca-ab97-7909d8f5ff97', 'authenticated', 'authenticated', 'constantlyamazinglda@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:03.37131Z', '2026-02-05T15:41:03.37131Z', '2026-02-05T15:41:03.974876Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '561dfc7f-24dd-443d-95d6-9abeef214b07', 'authenticated', 'authenticated', 'rpjborgestours@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:01.920028Z', '2026-02-05T15:41:01.920028Z', '2026-02-05T15:41:02.519853Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4a0210b7-bf12-426e-b196-4d256aba1d72', 'authenticated', 'authenticated', 'luizadedisin@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:41:00.129936Z', '2026-02-05T15:41:00.129936Z', '2026-02-05T15:41:00.717182Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0ab9cfb0-32b7-40a1-9e56-fcdc7adecdbf', 'authenticated', 'authenticated', 'ines@santoscreation.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:58.311645Z', '2026-02-05T15:40:58.311645Z', '2026-02-05T15:40:58.90209Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'dd6706ef-b1a6-41c2-9df8-4fe7b55e0c08', 'authenticated', 'authenticated', 'geral@jmcwines.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:57.008475Z', '2026-02-05T15:40:57.008475Z', '2026-02-05T15:40:57.600142Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '8c2d6230-9116-41b9-81a4-d95ffa23ed8e', 'authenticated', 'authenticated', 'cristianegabriel134@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:55.642788Z', '2026-02-05T15:40:55.642788Z', '2026-02-05T15:40:56.234453Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a8ea6cd2-906f-4892-98d4-5bacacdb0631', 'authenticated', 'authenticated', 'treinadortratadordecaes@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:54.232491Z', '2026-02-05T15:40:54.232491Z', '2026-02-05T15:40:54.832826Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a190c29e-38f1-4e5e-9d29-a034cc709861', 'authenticated', 'authenticated', 'dpvidal@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:52.880472Z', '2026-02-05T15:40:52.880472Z', '2026-02-05T15:40:53.473245Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0860e6f8-a27a-4a49-8672-e5e93f9d450d', 'authenticated', 'authenticated', 'ga1039@nyu.edu', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:51.436159Z', '2026-02-05T15:40:51.436159Z', '2026-02-05T15:40:52.039016Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '26240b71-36b3-4b50-bcb5-e4cb9fdc4da9', 'authenticated', 'authenticated', 'recadoseximios@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:50.122412Z', '2026-02-05T15:40:50.122412Z', '2026-02-05T15:40:50.716106Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '22870dcd-4627-4888-85da-f384f1a94bf5', 'authenticated', 'authenticated', 'mondi@outlook.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:48.607664Z', '2026-02-05T15:40:48.607664Z', '2026-02-05T15:40:49.208127Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '475b2b2e-12e5-4cb7-bc06-ec6a9aa6be42', 'authenticated', 'authenticated', 'varinderjeetsinghtvde@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:47.158119Z', '2026-02-05T15:40:47.158119Z', '2026-02-05T15:40:47.755945Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'c7c3136a-8af4-467d-a8b9-e5baf17241fa', 'authenticated', 'authenticated', '516470302@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:45.866797Z', '2026-02-05T15:40:45.866797Z', '2026-02-05T15:40:46.451828Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '6689144b-30b6-4d5f-be0c-324d2385d695', 'authenticated', 'authenticated', 'jorge.master2010@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:44.550025Z', '2026-02-05T15:40:44.550025Z', '2026-02-05T15:40:45.144939Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ec7c04d9-9342-4bbd-98c2-079d35d3b83f', 'authenticated', 'authenticated', 'ch@miaudigitalagency.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:43.219871Z', '2026-02-05T15:40:43.219871Z', '2026-02-05T15:40:43.834001Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'd341ccd2-988d-4cc1-8bf8-d5a751685135', 'authenticated', 'authenticated', 'evethemuse@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:41.832963Z', '2026-02-05T15:40:41.832963Z', '2026-02-05T15:40:42.422181Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '8ad05c1a-5da4-4806-b6e1-1ca960371ec1', 'authenticated', 'authenticated', 'costamarvaolda@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:40.453543Z', '2026-02-05T15:40:40.453543Z', '2026-02-05T15:40:41.050202Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '63dbe3d4-8bfb-444f-bdbd-cabfb3551c43', 'authenticated', 'authenticated', 'info.altamente4you@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:39.192226Z', '2026-02-05T15:40:39.192226Z', '2026-02-05T15:40:39.804403Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '229d6e96-a362-4b92-80a3-8242fe72d80d', 'authenticated', 'authenticated', 'nick@pauselabs.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:37.897041Z', '2026-02-05T15:40:37.897041Z', '2026-02-05T15:40:38.511919Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '06d7c01d-01f2-4f7f-9e73-7986292864d6', 'authenticated', 'authenticated', 'spalaciana@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:36.520339Z', '2026-02-05T15:40:36.520339Z', '2026-02-05T15:40:37.117176Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4215ba46-2f90-4e5f-9118-4fa7b4e5f0ff', 'authenticated', 'authenticated', 'mfsantos1971@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:35.24717Z', '2026-02-05T15:40:35.24717Z', '2026-02-05T15:40:35.857811Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '3e012301-c390-4211-9e63-ba0d3c7309d6', 'authenticated', 'authenticated', 'negocioscontentes@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:33.835761Z', '2026-02-05T15:40:33.835761Z', '2026-02-05T15:40:34.42864Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '01570539-6e1d-482e-b4ee-6b503ed9403b', 'authenticated', 'authenticated', 'limpezascc@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:32.493705Z', '2026-02-05T15:40:32.493705Z', '2026-02-05T15:40:33.083132Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '96d70d16-f355-402e-9e5e-e9be0a002ffe', 'authenticated', 'authenticated', 'accounting@indexconstellation.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:31.020033Z', '2026-02-05T15:40:31.020033Z', '2026-02-05T15:40:31.628066Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '58aa3887-7486-42fe-918c-49a8e1eadd8b', 'authenticated', 'authenticated', 'martinsjoaqui@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:29.67333Z', '2026-02-05T15:40:29.67333Z', '2026-02-05T15:40:30.264647Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '08ec0009-35e0-4ff8-af01-bbcdf7e045a4', 'authenticated', 'authenticated', '123456789@cliente.ivazen.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:29.618829Z', '2026-02-05T15:40:29.618829Z', '2026-02-05T15:40:30.276332Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'f5ee53c6-3460-4463-9bcb-16ec5d3c3b72', 'authenticated', 'authenticated', 'horasdazafama@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:28.302207Z', '2026-02-05T15:40:28.302207Z', '2026-02-05T15:40:28.882477Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'f959cdab-12d8-4c8f-888f-3e17a895dc73', 'authenticated', 'authenticated', 'corzada@corzada.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:26.960073Z', '2026-02-05T15:40:26.960073Z', '2026-02-05T15:40:27.549444Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e1934a45-7bf9-4cd1-a984-15f6f2052771', 'authenticated', 'authenticated', 'jairodoliveira1@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:25.644892Z', '2026-02-05T15:40:25.644892Z', '2026-02-05T15:40:26.252258Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'd25dd5b6-2582-432a-9a1c-ac1cb43f3f19', 'authenticated', 'authenticated', 'boloseaqui@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:24.277814Z', '2026-02-05T15:40:24.277814Z', '2026-02-05T15:40:24.875488Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '766f849b-61c4-443d-b078-2fadca406f2c', 'authenticated', 'authenticated', 'vascolopes.geral@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:22.806201Z', '2026-02-05T15:40:22.806201Z', '2026-02-05T15:40:23.40463Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1567b4ab-7a46-499c-ab5a-600ab30063db', 'authenticated', 'authenticated', 'olivier.soares@a2osinvest.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:21.421129Z', '2026-02-05T15:40:21.421129Z', '2026-02-05T15:40:22.003013Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e032d008-ad7d-4cb5-828c-c929ecf2dbe4', 'authenticated', 'authenticated', 'administracao@structuralshapes.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:19.893053Z', '2026-02-05T15:40:19.893053Z', '2026-02-05T15:40:20.573657Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '70146544-4503-4f98-96b3-27b99541286e', 'authenticated', 'authenticated', 'anamargaridacorreia7@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:18.415478Z', '2026-02-05T15:40:18.415478Z', '2026-02-05T15:40:19.005459Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ff3a841f-4370-46d6-b182-d211795c05d3', 'authenticated', 'authenticated', 'alexobra01@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:17.041372Z', '2026-02-05T15:40:17.041372Z', '2026-02-05T15:40:17.620281Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a21801db-ef5b-4bd4-a18b-391bb3be07b1', 'authenticated', 'authenticated', 'personal.home@annaludmilla.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:15.669468Z', '2026-02-05T15:40:15.669468Z', '2026-02-05T15:40:16.264495Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '78a9e838-296b-4573-938c-45b002e49a24', 'authenticated', 'authenticated', 'saramricardo@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:14.332096Z', '2026-02-05T15:40:14.332096Z', '2026-02-05T15:40:14.914495Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b828c3cd-1cac-4faa-ba58-cc699628cca6', 'authenticated', 'authenticated', 'topodascenas2019@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:13.004451Z', '2026-02-05T15:40:13.004451Z', '2026-02-05T15:40:13.600081Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e8bdd35f-7ef6-45af-9b73-139dff1ad97d', 'authenticated', 'authenticated', 'ffguerra.unipessoal@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:11.439407Z', '2026-02-05T15:40:11.439407Z', '2026-02-05T15:40:12.05853Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1c4c3bbd-1f93-44a5-9485-f443fea9b9a0', 'authenticated', 'authenticated', 'evansar09@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:10.093933Z', '2026-02-05T15:40:10.093933Z', '2026-02-05T15:40:10.694681Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '9437df6b-815c-47c8-9151-2d3758d744be', 'authenticated', 'authenticated', 'h.oliveira@manatwork.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:08.618576Z', '2026-02-05T15:40:08.618576Z', '2026-02-05T15:40:09.235864Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'd0a0d95a-71b9-4715-acd7-f37e11ea3782', 'authenticated', 'authenticated', 'pedrovki@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:07.200553Z', '2026-02-05T15:40:07.200553Z', '2026-02-05T15:40:07.789891Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4652ec14-2d36-49ce-933e-1c5941622c16', 'authenticated', 'authenticated', 'imaginaryclima@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:05.801087Z', '2026-02-05T15:40:05.801087Z', '2026-02-05T15:40:06.405578Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '688b3e03-0157-4e19-b387-787c9246436e', 'authenticated', 'authenticated', 'l.najari@clinisciences.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:40:04.364738Z', '2026-02-05T15:40:04.364738Z', '2026-02-05T15:40:04.952251Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '73490602-504b-4d2c-ae9d-5c3857d66390', 'authenticated', 'authenticated', 'cardinalifilomena@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:59.478456Z', '2026-02-05T15:39:59.478456Z', '2026-02-05T15:40:00.064496Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1a0bc1a5-7494-4522-b3ce-2289a04b1a0c', 'authenticated', 'authenticated', 'salao.bc@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:57.988066Z', '2026-02-05T15:39:57.988066Z', '2026-02-05T15:39:58.608287Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b11751b3-d7fc-4052-99ed-d35ab609d0fa', 'authenticated', 'authenticated', 'ttpronto@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:56.6333Z', '2026-02-05T15:39:56.6333Z', '2026-02-05T15:39:57.220985Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '528c5ffd-8c11-48b1-965f-6cde36a3ae9a', 'authenticated', 'authenticated', 'paginaplural@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:55.184736Z', '2026-02-05T15:39:55.184736Z', '2026-02-05T15:39:55.823497Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a74f16b5-0022-4392-b97c-fad89d0d18c8', 'authenticated', 'authenticated', 'nuno.linder@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:53.788501Z', '2026-02-05T15:39:53.788501Z', '2026-02-05T15:39:54.383926Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '91d36449-dd68-4870-a8f6-d3c037d97db4', 'authenticated', 'authenticated', 'latitudefemera@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:52.428037Z', '2026-02-05T15:39:52.428037Z', '2026-02-05T15:39:53.028025Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '953b3cc6-763f-4063-9860-a11bc3700f5c', 'authenticated', 'authenticated', 'geral@mpiresnogueira.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:51.017854Z', '2026-02-05T15:39:51.017854Z', '2026-02-05T15:39:51.614693Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1f9ce116-c3b6-4d79-92cd-ca2c147ac087', 'authenticated', 'authenticated', 'geral@apintoemarques.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:49.569407Z', '2026-02-05T15:39:49.569407Z', '2026-02-05T15:39:50.169866Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '37991505-7c55-4338-a4c5-8a5624db5dc6', 'authenticated', 'authenticated', 'mj.canada.g@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:48.189847Z', '2026-02-05T15:39:48.189847Z', '2026-02-05T15:39:48.788461Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '29deb3a1-76b7-4197-a3bc-52fd003599cb', 'authenticated', 'authenticated', 'mariamendes@ownrising.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:46.730845Z', '2026-02-05T15:39:46.730845Z', '2026-02-05T15:39:47.33637Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '8d63812c-fc9c-46ce-8a1d-03c358b25082', 'authenticated', 'authenticated', 'paulojorgecorreiadagraca@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:45.371254Z', '2026-02-05T15:39:45.371254Z', '2026-02-05T15:39:45.976035Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '860efb9e-875f-445f-ab07-5a3fd38eb021', 'authenticated', 'authenticated', 'alexandrecastanho.lda@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:43.988104Z', '2026-02-05T15:39:43.988104Z', '2026-02-05T15:39:44.585698Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '00cb3690-a66a-488a-a06c-0ac4b1a33857', 'authenticated', 'authenticated', 'translaratransporteslda@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:42.603003Z', '2026-02-05T15:39:42.603003Z', '2026-02-05T15:39:43.225514Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '5ccf3b5a-661f-4d6e-8b3c-6bea9bcd332d', 'authenticated', 'authenticated', 'mar.neves66@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:41.195116Z', '2026-02-05T15:39:41.195116Z', '2026-02-05T15:39:41.80976Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'd165720b-36d7-4248-8b92-be05ef779dc0', 'authenticated', 'authenticated', 'almeidadaniel2424@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:39.816932Z', '2026-02-05T15:39:39.816932Z', '2026-02-05T15:39:40.431882Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '57182841-d1d6-45a1-bc54-338529a470a6', 'authenticated', 'authenticated', 'prismtech15@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:37.743152Z', '2026-02-05T15:39:37.743152Z', '2026-02-05T15:39:38.350023Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a0b5978e-ce55-4461-a571-ce527950e089', 'authenticated', 'authenticated', 'joao.pedro@tecnicalha.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:36.262404Z', '2026-02-05T15:39:36.262404Z', '2026-02-05T15:39:36.870417Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4cb73761-9ee5-4fac-8fde-2efd428f87ed', 'authenticated', 'authenticated', 'joaoalbuq@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:34.807916Z', '2026-02-05T15:39:34.807916Z', '2026-02-05T15:39:35.415361Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '03e63301-32f5-41cb-8707-18749e217690', 'authenticated', 'authenticated', 'neill.brett@easol.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:33.449587Z', '2026-02-05T15:39:33.449587Z', '2026-02-05T15:39:34.03339Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '84af8cd8-fa94-4e19-b752-d2c76b259576', 'authenticated', 'authenticated', 'dplda@investments-advisory.eu', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:32.067591Z', '2026-02-05T15:39:32.067591Z', '2026-02-05T15:39:32.665448Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1f0bb22e-b1d4-4d00-9d70-fc576143880b', 'authenticated', 'authenticated', '2impress.alverca@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:30.658223Z', '2026-02-05T15:39:30.658223Z', '2026-02-05T15:39:31.259019Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e5748771-82d2-4421-8a6a-0e462a9bb0fb', 'authenticated', 'authenticated', 'carlval@live.com.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:29.28703Z', '2026-02-05T15:39:29.28703Z', '2026-02-05T15:39:29.875191Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7bead79a-e18d-40f5-b3b9-084d3568fd2c', 'authenticated', 'authenticated', 'fronteira.63@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:27.886147Z', '2026-02-05T15:39:27.886147Z', '2026-02-05T15:39:28.478552Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'dcfdd1dd-c247-4206-98ee-3c8780962550', 'authenticated', 'authenticated', 'f.miguelgomes85@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:26.433551Z', '2026-02-05T15:39:26.433551Z', '2026-02-05T15:39:27.024747Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b928ebfb-0742-4d4d-baef-0eca29eea7dc', 'authenticated', 'authenticated', 'ricardoclaro@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:24.345469Z', '2026-02-05T15:39:24.345469Z', '2026-02-05T15:39:24.966471Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'd93164e5-4224-45ed-b925-34862c121837', 'authenticated', 'authenticated', 'sales@m4gadget.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:21.858037Z', '2026-02-05T15:39:21.858037Z', '2026-02-05T15:39:22.454753Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a47ea7bf-57fa-4480-aaad-fa29d7c5b5de', 'authenticated', 'authenticated', 'anad1990@hotmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:20.399033Z', '2026-02-05T15:39:20.399033Z', '2026-02-05T15:39:21.016073Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4986dd95-da8c-4fb6-930f-4322ff5cd710', 'authenticated', 'authenticated', 'scate@veebeedee.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:17.793205Z', '2026-02-05T15:39:17.793205Z', '2026-02-05T15:39:18.434428Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '57b110d1-ce15-4cd5-aff6-cbfa0318ba92', 'authenticated', 'authenticated', 'sarahj545@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:15.208767Z', '2026-02-05T15:39:15.208767Z', '2026-02-05T15:39:15.811627Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'e7ba9f23-4b6f-46bd-b1ec-2d78ef7dffc9', 'authenticated', 'authenticated', 'rui.carvalho@hectacom.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:13.748931Z', '2026-02-05T15:39:13.748931Z', '2026-02-05T15:39:14.358237Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '052b4779-0a1c-46eb-9f5b-6a72615565da', 'authenticated', 'authenticated', 'rui.carvalho@madeirainvestment.org', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:12.317486Z', '2026-02-05T15:39:12.317486Z', '2026-02-05T15:39:12.928972Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '3f867960-b479-434c-ac8b-04f9bb2fd91c', 'authenticated', 'authenticated', '23tipografia@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:10.798229Z', '2026-02-05T15:39:10.798229Z', '2026-02-05T15:39:11.410992Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '738bcc38-7a26-4215-b169-69d54b81ec02', 'authenticated', 'authenticated', 'barbara.monteiro@liveasylisbon.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:09.48754Z', '2026-02-05T15:39:09.48754Z', '2026-02-05T15:39:10.07794Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '37dafd96-7c90-4171-916d-ddb1f11b7b29', 'authenticated', 'authenticated', 'soniasalvador@lavesec.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:08.09862Z', '2026-02-05T15:39:08.09862Z', '2026-02-05T15:39:08.689876Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'bb5c9573-5c19-4f7e-87d3-4cbbd58a3ce4', 'authenticated', 'authenticated', 'soraia@abbeygate.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:06.660172Z', '2026-02-05T15:39:06.660172Z', '2026-02-05T15:39:07.277878Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '9b12c8de-c969-4596-b816-4bb0a24c6a06', 'authenticated', 'authenticated', 'geraljmraluminios@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:05.152599Z', '2026-02-05T15:39:05.152599Z', '2026-02-05T15:39:05.746914Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b44a17db-8b4c-4983-a983-e4402350f1f9', 'authenticated', 'authenticated', 'proimovelac@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:03.747836Z', '2026-02-05T15:39:03.747836Z', '2026-02-05T15:39:04.35211Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '43b0ff47-1d48-43c8-a951-3db01fc67a6c', 'authenticated', 'authenticated', 'ch@imprimircomarte.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:02.462549Z', '2026-02-05T15:39:02.462549Z', '2026-02-05T15:39:03.043387Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a299217d-3636-409c-b904-167b4ccf8cc3', 'authenticated', 'authenticated', 'rui.nelson@safespot.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:39:00.075908Z', '2026-02-05T15:39:00.075908Z', '2026-02-05T15:39:00.677287Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ceafc0e2-9fbd-427b-8d66-0e5c0f18289e', 'authenticated', 'authenticated', 'saboresdonorte@sapo.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:38:58.757079Z', '2026-02-05T15:38:58.757079Z', '2026-02-05T15:38:59.340614Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'b54e8e71-03e7-4679-bbaa-fb9b4bdb5e85', 'authenticated', 'authenticated', 'geral@rbg.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:38:57.230738Z', '2026-02-05T15:38:57.230738Z', '2026-02-05T15:38:57.822141Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '74894cdc-cc48-4972-b5c4-37006b4abcab', 'authenticated', 'authenticated', 'accounts@valueleaf.eu', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:38:55.894106Z', '2026-02-05T15:38:55.894106Z', '2026-02-05T15:38:56.50325Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '739b6c99-2b97-409c-9f04-21a9015f425d', 'authenticated', 'authenticated', 'followfield@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:38:53.727767Z', '2026-02-05T15:38:53.727767Z', '2026-02-05T15:38:54.332811Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'bb10478e-71f5-4bdd-a1e2-49efd6c5c942', 'authenticated', 'authenticated', 'olivier.soares@arq1to1.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:38:51.720588Z', '2026-02-05T15:38:51.720588Z', '2026-02-05T15:38:52.322499Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'ab7aa60e-4311-4d46-8406-921469100d87', 'authenticated', 'authenticated', 'marco.p.s.martins@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:38:50.257335Z', '2026-02-05T15:38:50.257335Z', '2026-02-05T15:38:50.860842Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '58b4012f-c2d1-46e5-8555-4f42a464ff34', 'authenticated', 'authenticated', 'orthominho@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:38:48.781668Z', '2026-02-05T15:38:48.781668Z', '2026-02-05T15:38:49.398245Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a6cf0ac0-8aba-479a-885d-3afadbb1f977', 'authenticated', 'authenticated', 'specialkidscp@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:38:47.36847Z', '2026-02-05T15:38:47.36847Z', '2026-02-05T15:38:47.952525Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '69aaffc0-7a22-409d-9af7-6f6f359c7f20', 'authenticated', 'authenticated', 'celia@margoncel.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:38:46.084488Z', '2026-02-05T15:38:46.084488Z', '2026-02-05T15:38:46.66937Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7d6c5397-b264-4507-b74c-31700541e67a', 'authenticated', 'authenticated', 'jeroentaylor@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:38:43.978958Z', '2026-02-05T15:38:43.978958Z', '2026-02-05T15:38:44.560249Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '6abbae2f-9f5d-4c8d-8021-1f175b61cb60', 'authenticated', 'authenticated', 'manuelgomes@inforgeo.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:38:42.547145Z', '2026-02-05T15:38:42.547145Z', '2026-02-05T15:38:43.159069Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '59cbd785-0ee5-4cec-afc1-1c49862f086c', 'authenticated', 'authenticated', 'sc1983@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:38:40.365498Z', '2026-02-05T15:38:40.365498Z', '2026-02-05T15:38:40.959616Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '3620b73e-0e04-42b3-bc88-9201fc8f6ff4', 'authenticated', 'authenticated', 'geral@solimpo.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:38:38.955528Z', '2026-02-05T15:38:38.955528Z', '2026-02-05T15:38:39.552163Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'c721702b-2e9b-4e54-b2a1-3ac2870dd45d', 'authenticated', 'authenticated', 'marisa.santos@auraicity.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-02-05T15:38:37.506743Z', '2026-02-05T15:38:37.506743Z', '2026-02-05T15:38:38.125134Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '93770a8d-2db9-42d3-bda0-de3daaedd340', 'authenticated', 'authenticated', 'sylvain.belahniche@2iqresearch.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-01-23T11:56:37.495833Z', '2026-01-23T11:56:37.495833Z', '2026-01-23T11:56:38.149522Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'f86cd4e8-6ac7-4e60-a5eb-ff57df5015dc', 'authenticated', 'authenticated', 'contabilidade@tecnilight.net', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-01-23T11:15:42.1589Z', '2026-01-23T11:15:42.1589Z', '2026-01-23T11:15:42.837544Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'd811079e-4acc-4a6d-9ea4-5b022005330d', 'authenticated', 'authenticated', 'milla.resende@accountingadvantage.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-01-16T11:34:20.948434Z', '2026-01-16T11:34:20.948434Z', '2026-01-16T11:34:20.978173Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '4cbe8e41-8127-49e2-a3f7-81bbfca89926', 'authenticated', 'authenticated', 'adelia.gaspar@accountingadvantage.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-01-16T11:27:40.23726Z', '2026-01-16T11:27:40.23726Z', '2026-02-28T11:58:02.149696Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '7c842887-b9d3-4c52-9726-771625a486aa', 'authenticated', 'authenticated', 'payroll@accountingadvantage.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2026-01-07T15:16:11.217941Z', '2026-01-07T15:16:11.217941Z', '2026-01-08T09:44:36.392435Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '6e86bd76-1305-4009-9010-a2644da5a624', 'authenticated', 'authenticated', 'mailin.huelsmann@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2025-12-22T17:56:49.117116Z', '2025-12-22T17:56:49.117116Z', '2025-12-22T17:56:49.227946Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'dc6ccdc2-9d5e-4fd3-883b-e01a70ed4a62', 'authenticated', 'authenticated', 'terezarolo66@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2025-12-22T17:54:29.078651Z', '2025-12-22T17:54:29.078651Z', '2025-12-22T17:54:29.235502Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '311e6110-6402-436f-92e5-6a9a8e07f5cd', 'authenticated', 'authenticated', 'claudia.azevedo@accountingadvantage.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2025-12-19T12:06:01.153071Z', '2025-12-19T12:06:01.153071Z', '2025-12-19T14:38:12.281901Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '9f228c9f-11e1-442a-9077-3ad14c621261', 'authenticated', 'authenticated', 'raquel.gomes@accountingadvantage.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2025-12-19T11:57:24.026582Z', '2025-12-19T11:57:24.026582Z', '2025-12-31T10:18:40.542619Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '0d9b91b1-bf6f-403e-8d33-d90baca0faaf', 'authenticated', 'authenticated', 'claudiaazevedo.zumba@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2025-12-19T11:52:00.903237Z', '2025-12-19T11:52:00.903237Z', '2025-12-19T11:52:00.973627Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '9826880a-5b5f-48f7-a5dc-d2a6cf1478b9', 'authenticated', 'authenticated', 'noah.gosta.de.robos@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2025-12-18T21:16:10.487339Z', '2025-12-18T21:16:10.487339Z', '2025-12-18T21:16:10.529346Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '418149f4-0a23-4e0e-88e7-623fe4de8a5e', 'authenticated', 'authenticated', 'noah.machraa@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2025-12-18T21:02:16.214331Z', '2025-12-18T21:02:16.214331Z', '2025-12-18T21:23:18.26085Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'a3f28050-711c-4a37-9994-0a85059f19d6', 'authenticated', 'authenticated', 'bilal.machra@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2025-12-08T17:06:36.526353Z', '2025-12-08T17:06:36.526353Z', '2026-02-24T14:48:45.11361Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '980f4331-f39d-46b7-b6f1-274f95dab9ad', 'authenticated', 'authenticated', 'bilal.machraa@gmail.com', crypt('IVAzen-Temp-2026!', gen_salt('bf')), '2025-12-08T02:27:40.2892Z', '2025-12-08T02:27:40.2892Z', '2026-02-28T15:42:03.632178Z', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Total: 406 users