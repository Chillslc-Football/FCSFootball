-- Edge Function admin client (service_role / sb_secret) needs table privileges.
-- The notifications migration revoked anon/authenticated access but did not grant service_role.

GRANT ALL ON TABLE public.devices TO service_role;
GRANT ALL ON TABLE public.device_favorites TO service_role;
GRANT ALL ON TABLE public.device_followed_games TO service_role;
GRANT ALL ON TABLE public.monitored_games TO service_role;
GRANT ALL ON TABLE public.sent_notification_events TO service_role;
GRANT ALL ON TABLE public.notification_preferences TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
