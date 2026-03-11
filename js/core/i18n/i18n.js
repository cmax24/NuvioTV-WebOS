import { LocalStore } from "../storage/localStore.js";

const LANGUAGE_STORE_KEY = "appLanguage";
const DEFAULT_LANGUAGE = "en";
const SUPPORTED_LANGUAGES = ["en", "it"];

const TRANSLATIONS = {
  en: {
    "language.english": "English",
    "language.italian": "Italian",

    "common.loading": "Loading...",
    "common.back": "Back",
    "common.open": "Open",
    "common.sort": "Sort",
    "common.install": "Install",
    "common.remove": "Remove",
    "common.up": "Up",
    "common.down": "Down",
    "common.profile": "Profile",
    "common.on": "ON",
    "common.off": "OFF",
    "common.untitled": "Untitled",
    "common.content": "Content",
    "common.select": "Select",
    "detail.play": "Play",
    "detail.resume": "Resume",
    "detail.expand": "Expand",
    "detail.collapse": "Collapse",
    "detail.play_next_episode": "Play Next Episode",
    "detail.next_episode_short": "Next S{season}E{episode}",

    "nav.home": "Home",
    "nav.search": "Search",
    "nav.library": "Library",
    "nav.addons": "Addons",
    "nav.settings": "Settings",
    "nav.account": "Account",

    "type.movie": "Movie",
    "type.series": "Series",
    "type.catalog": "Catalog",
    "type.tv": "TV",

    "app.config_missing_title": "Runtime configuration missing",
    "app.config_missing_body": "Provide valid SUPABASE_URL and SUPABASE_ANON_KEY in js/config.runtime.js before launching the app.",

    "settings.section.account.label": "Account",
    "settings.section.account.subtitle": "Account and sync status.",
    "settings.section.profiles.label": "Profiles",
    "settings.section.profiles.subtitle": "Manage user profiles for this account.",
    "settings.section.appearance.label": "Appearance",
    "settings.section.appearance.subtitle": "Choose theme and visual preferences.",
    "settings.section.layout.label": "Layout",
    "settings.section.layout.subtitle": "Home layout and navigation behavior.",
    "settings.section.plugins.label": "Plugins",
    "settings.section.plugins.subtitle": "Manage repositories and plugin runtime.",
    "settings.section.integration.label": "Integration",
    "settings.section.integration.subtitle": "Cloud sync and metadata integration.",
    "settings.section.playback.label": "Playback",
    "settings.section.playback.subtitle": "Video, audio, and subtitle defaults.",
    "settings.section.trakt.label": "Trakt",
    "settings.section.trakt.subtitle": "Trakt integration status.",
    "settings.section.about.label": "About",
    "settings.section.about.subtitle": "App information and links.",
    "settings.empty_section": "No options in this section.",

    "settings.account.signed_in": "Signed in",
    "settings.account.not_signed_in": "Not signed in",
    "settings.account.signed_in_desc": "Account linked on this TV.",
    "settings.account.not_signed_in_desc": "Open QR login to connect account.",
    "settings.account.open_account": "Open account screen",
    "settings.account.open_account_desc": "View sync overview and linked status.",
    "settings.account.sign_out": "Sign out",
    "settings.account.sign_out_desc": "Disconnect account from this TV.",

    "settings.profiles.active_suffix": " (Active)",
    "settings.profiles.primary": "Primary profile",
    "settings.profiles.secondary": "Secondary profile",
    "settings.profiles.open_selection": "Open profile selection",
    "settings.profiles.open_selection_desc": "Go back to profile chooser.",

    "settings.layout.reset_home_catalog_prefs": "Reset home catalog prefs",
    "settings.layout.reset_home_catalog_prefs_desc": "Restore catalog order and visibility.",
    "settings.layout.remote_dpad": "Remote D-Pad mapping: {mode}",
    "settings.layout.remote_dpad_rotated": "Rotated",
    "settings.layout.remote_dpad_standard": "Standard",
    "settings.layout.remote_dpad_desc": "Switch if arrows feel swapped on your TV.",
    "settings.layout.remote_grid": "Remote grid navigation: {mode}",
    "settings.layout.remote_grid_strict": "Strict",
    "settings.layout.remote_grid_flexible": "Flexible",
    "settings.layout.remote_grid_desc": "Strict matches Android-style row/column navigation.",

    "settings.plugins.open_manager": "Open plugins manager",
    "settings.plugins.open_manager_desc": "Manage plugin runtime and repositories.",
    "settings.plugins.sync_pull": "Sync pull plugins",
    "settings.plugins.sync_pull_desc": "Download plugin repositories from cloud.",
    "settings.plugins.sync_push": "Sync push plugins",
    "settings.plugins.sync_push_desc": "Upload local plugin repositories to cloud.",

    "settings.integration.tmdb_enrichment": "TMDB enrichment: {state}",
    "settings.integration.tmdb_enrichment_desc": "Enable TMDB metadata enrichment.",
    "settings.integration.tmdb_artwork": "TMDB artwork: {state}",
    "settings.integration.tmdb_artwork_desc": "Use poster/logo/backdrop from TMDB.",
    "settings.integration.tmdb_key": "Set TMDB API key",
    "settings.integration.tmdb_key_configured": "TMDB key configured.",
    "settings.integration.tmdb_key_missing": "No TMDB key configured.",
    "settings.integration.tmdb_key_prompt": "Insert TMDB API key",
    "settings.integration.sync_pull_all": "Sync pull all",
    "settings.integration.sync_pull_all_desc": "Download profiles/plugins/addons/library/progress.",
    "settings.integration.sync_push_all": "Sync push all",
    "settings.integration.sync_push_all_desc": "Upload profiles/plugins/addons/library/progress.",

    "settings.language.current": "Language: {language}",
    "settings.language.current_desc": "Set app language. First launch follows system language.",
    "settings.language.switch": "Switch to {language}",
    "settings.language.switch_desc": "Apply this language for the interface.",
    "settings.language.already_selected": "Currently selected.",

    "settings.trakt.open_account": "Open account",
    "settings.trakt.open_account_desc": "Manage Trakt from account section.",

    "settings.about.build": "Nuvio webOS build",
    "settings.about.build_desc": "Full webOS mode (Android parity migration).",
    "settings.about.privacy": "Privacy policy",
    "settings.about.privacy_desc": "Open privacy page.",

    "theme.apply_dark": "Apply Dark Theme",
    "theme.apply_dark_desc": "Current accent: {accent}",
    "theme.apply_cinema": "Apply Cinema Theme",
    "theme.apply_cinema_desc": "Higher contrast blue-black palette.",
    "theme.accent_white": "Accent White",
    "theme.accent_white_desc": "Android default focus style.",
    "theme.accent_crimson": "Accent Crimson",
    "theme.accent_crimson_desc": "High contrast warm accent.",
    "theme.accent_ocean": "Accent Ocean",
    "theme.accent_ocean_desc": "Blue accent.",
    "theme.accent_violet": "Accent Violet",
    "theme.accent_violet_desc": "Purple accent.",
    "theme.accent_emerald": "Accent Emerald",
    "theme.accent_emerald_desc": "Green accent.",
    "theme.accent_amber": "Accent Amber",
    "theme.accent_amber_desc": "Amber accent.",

    "playback.autoplay": "Autoplay Next: {state}",
    "playback.autoplay_desc": "Toggle automatic next episode.",
    "playback.subtitles": "Subtitles: {state}",
    "playback.subtitles_desc": "Toggle subtitles by default.",
    "playback.quality": "Quality target: {quality}",
    "playback.quality_desc": "Cycle Auto -> 2160p -> 1080p -> 720p.",
    "playback.quality_auto": "Auto",

    "home.context_select_title": "Select a title",
    "home.context_pick_something": "Browse your rows and pick something to watch.",
    "home.context_row_home": "Home",
    "home.context_label_type": "Type",
    "home.context_label_year": "Year",
    "home.context_label_score": "Score",
    "home.see_all_in": "See all in {row}",
    "home.see_all_titles": "See all titles",
    "home.see_all_desc": "Open the full catalog list for this row.",
    "home.see_all": "See All",
    "home.continue_watching": "Continue Watching",
    "home.no_saved_progress": "No saved progress yet.",
    "home.continue": "Continue",
    "home.minutes_left": "{value}m left",
    "home.minutes_watched": "{value}m watched",

    "library.loading": "Loading library...",
    "library.no_saved_items": "No saved items.",
    "library.no_continue_items": "No continue watching items.",
    "library.title": "Library",
    "library.tab_all": "All",
    "library.tab_movie": "Movie",
    "library.tab_series": "Series",
    "library.row_continue": "Continue Watching",
    "library.row_saved": "Saved",

    "search.loading": "Loading...",
    "search.no_results_title": "No Results",
    "search.no_results_desc": "Try another keyword.",
    "search.start_title": "Start Searching",
    "search.start_desc": "Enter at least 2 characters.",
    "search.see_all": "See All",
    "search.placeholder": "Search movies and series",
    "search.from_addon": "from {addon}",
    "search.default_addon": "Addon",

    "discover.title": "Discover",
    "discover.filter_type": "Type",
    "discover.filter_catalog": "Catalog",
    "discover.filter_genre": "Genre",
    "discover.default_genre": "Default",
    "discover.no_catalog_selected": "No catalog selected",
    "discover.no_content": "No content found.",

    "stream.filter_all": "All",
    "stream.source_suffix": "{addon} stream",
    "stream.card_stream": "Stream",
    "stream.loading_streams": "Loading streams...",
    "stream.no_streams_filter": "No streams found for this filter.",
    "stream.select_source_episode": "Select a source to start episode playback.",
    "stream.select_source_movie": "Select a source to start playback.",
    "stream.tag_torrent": "Torrent",
    "stream.tag_stream": "Stream",

    "catalog.fallback_title": "Catalog",
    "catalog.no_items": "No items available.",
    "catalog.load_more": "Load More",
    "catalog.no_more": "No More",

    "plugin.title": "Addons",
    "plugin.install_title": "Install addon",
    "plugin.install_url_hint": "https://example.com",
    "plugin.manage_phone_title": "Manage from phone",
    "plugin.manage_phone_desc": "Scan a QR code to manage addons and Home catalogs from your phone.",
    "plugin.reorder_title": "Reorder home catalogs",
    "plugin.reorder_desc": "Controls catalog row order on Home (Classic + Modern + Grid).",
    "plugin.installed_title": "Installed",
    "plugin.empty_installed": "No addons installed yet.",
    "plugin.unknown_addon": "Unknown addon",
    "plugin.no_description": "No description available.",
    "plugin.prompt_install": "Install addon URL",

    "account.loading": "Loading account...",
    "account.title": "Account",
    "account.sign_in_prompt": "Sign in to sync your library and preferences.",
    "account.sign_in": "Sign In",
    "account.sign_in_desc": "Use QR sign-in from mobile.",
    "account.signed_in_as": "Signed in as",
    "account.user_default": "User",
    "account.sign_out": "Sign Out",

    "auth_qr.sign_in_title": "Sign in with QR",
    "auth_qr.sign_in_desc": "Use your phone to login with email and password.",
    "auth_qr.account_login_title": "Account Login",
    "auth_qr.account_login_desc": "Scan QR, approve in browser, then return here.",
    "auth_qr.refresh": "Refresh QR",
    "auth_qr.enter_as_guest": "Enter as guest",
    "auth_qr.continue_without_account": "Continue without account",
    "auth_qr.code": "Code: {code}",
    "auth_qr.expired": "Expired",
    "auth_qr.expires_in": "Expires in {time}",
    "auth_qr.approved_finishing": "Approved. Finishing login...",
    "auth_qr.qr_expired_retry": "QR expired. Refresh to retry.",
    "auth_qr.error_unavailable": "QR unavailable. Try again.",
    "auth_qr.error_invalid_redirect": "QR backend redirect URL is invalid. Check TV login SQL setup.",
    "auth_qr.error_missing_function": "QR backend function is missing. Re-run TV login SQL setup.",
    "auth_qr.error_missing_extension": "QR backend missing extension. Re-run SQL setup for TV login.",
    "auth_qr.error_invalid_caller_session": "QR session is no longer valid. Refresh the QR and try again.",
    "auth_qr.error_network": "Network error while generating QR.",
    "auth_qr.error_with_reason": "QR unavailable: {reason}",

    "sync_code.title": "Sync Code",
    "sync_code.current": "Current code: {value}",
    "sync_code.empty": "(empty)",
    "sync_code.set": "Set Code",
    "sync_code.clear": "Clear Code",
    "sync_code.prompt": "Insert sync code",

    "profile_selection.title": "Who's watching?",
    "profile_selection.subtitle": "Select a profile to continue.",
    "profile_selection.hint": "Use D-pad to choose a profile.",
    "profile_selection.primary": "PRIMARY",

    "account_settings.loading": "Loading...",
    "account_settings.signed_out_desc": "Sync your library and preferences across devices.",
    "account_settings.sign_in_qr": "Sign in with QR",
    "account_settings.sign_in_qr_desc": "Scan a QR code to link this device.",
    "account_settings.signed_in_as": "Signed in as",
    "account_settings.loading_overview": "Loading sync overview...",
    "account_settings.stat_addons": "addons",
    "account_settings.stat_plugins": "plugins",
    "account_settings.stat_library": "library",
    "account_settings.stat_progress": "progress",
    "account_settings.stat_watched": "watched",

    "watched.badge": "Watched",
    "sidebar.navigation_title": "Navigation",
    "sidebar.item": "Item",
  },
  it: {
    "language.english": "Inglese",
    "language.italian": "Italiano",

    "common.loading": "Caricamento...",
    "common.back": "Indietro",
    "common.open": "Apri",
    "common.sort": "Ordina",
    "common.install": "Installa",
    "common.remove": "Rimuovi",
    "common.up": "Su",
    "common.down": "Giu",
    "common.profile": "Profilo",
    "common.on": "ON",
    "common.off": "OFF",
    "common.untitled": "Senza titolo",
    "common.content": "Contenuto",
    "common.select": "Seleziona",
    "detail.play": "Riproduci",
    "detail.resume": "Riprendi",
    "detail.expand": "Espandi",
    "detail.collapse": "Riduci",
    "detail.play_next_episode": "Riproduci episodio successivo",
    "detail.next_episode_short": "Prossimo S{season}E{episode}",

    "nav.home": "Home",
    "nav.search": "Cerca",
    "nav.library": "Libreria",
    "nav.addons": "Addon",
    "nav.settings": "Impostazioni",
    "nav.account": "Account",

    "type.movie": "Film",
    "type.series": "Serie",
    "type.catalog": "Catalogo",
    "type.tv": "TV",

    "app.config_missing_title": "Configurazione runtime mancante",
    "app.config_missing_body": "Inserisci SUPABASE_URL e SUPABASE_ANON_KEY validi in js/config.runtime.js prima di avviare l'app.",

    "settings.section.account.label": "Account",
    "settings.section.account.subtitle": "Stato account e sincronizzazione.",
    "settings.section.profiles.label": "Profili",
    "settings.section.profiles.subtitle": "Gestisci i profili utente di questo account.",
    "settings.section.appearance.label": "Aspetto",
    "settings.section.appearance.subtitle": "Tema e preferenze visive.",
    "settings.section.layout.label": "Layout",
    "settings.section.layout.subtitle": "Layout Home e comportamento della navigazione.",
    "settings.section.plugins.label": "Plugin",
    "settings.section.plugins.subtitle": "Gestisci repository e runtime plugin.",
    "settings.section.integration.label": "Integrazione",
    "settings.section.integration.subtitle": "Sync cloud e integrazione metadata.",
    "settings.section.playback.label": "Riproduzione",
    "settings.section.playback.subtitle": "Predefiniti video, audio e sottotitoli.",
    "settings.section.trakt.label": "Trakt",
    "settings.section.trakt.subtitle": "Stato integrazione Trakt.",
    "settings.section.about.label": "Informazioni",
    "settings.section.about.subtitle": "Informazioni app e link utili.",
    "settings.empty_section": "Nessuna opzione in questa sezione.",

    "settings.account.signed_in": "Accesso effettuato",
    "settings.account.not_signed_in": "Non connesso",
    "settings.account.signed_in_desc": "Account collegato su questa TV.",
    "settings.account.not_signed_in_desc": "Apri il login QR per collegare l'account.",
    "settings.account.open_account": "Apri schermata account",
    "settings.account.open_account_desc": "Mostra stato sincronizzazione e collegamento.",
    "settings.account.sign_out": "Disconnetti",
    "settings.account.sign_out_desc": "Scollega l'account da questa TV.",

    "settings.profiles.active_suffix": " (Attivo)",
    "settings.profiles.primary": "Profilo principale",
    "settings.profiles.secondary": "Profilo secondario",
    "settings.profiles.open_selection": "Apri selezione profilo",
    "settings.profiles.open_selection_desc": "Torna alla scelta profilo.",

    "settings.layout.reset_home_catalog_prefs": "Reset preferenze cataloghi Home",
    "settings.layout.reset_home_catalog_prefs_desc": "Ripristina ordine e visibilita cataloghi.",
    "settings.layout.remote_dpad": "Mappatura D-Pad telecomando: {mode}",
    "settings.layout.remote_dpad_rotated": "Ruotata",
    "settings.layout.remote_dpad_standard": "Standard",
    "settings.layout.remote_dpad_desc": "Usa questa opzione se le frecce risultano invertite.",
    "settings.layout.remote_grid": "Navigazione griglia telecomando: {mode}",
    "settings.layout.remote_grid_strict": "Rigida",
    "settings.layout.remote_grid_flexible": "Flessibile",
    "settings.layout.remote_grid_desc": "La modalita rigida segue la navigazione a righe/colonne.",

    "settings.plugins.open_manager": "Apri gestione plugin",
    "settings.plugins.open_manager_desc": "Gestisci runtime plugin e repository.",
    "settings.plugins.sync_pull": "Sync pull plugin",
    "settings.plugins.sync_pull_desc": "Scarica i repository plugin dal cloud.",
    "settings.plugins.sync_push": "Sync push plugin",
    "settings.plugins.sync_push_desc": "Carica i repository plugin locali nel cloud.",

    "settings.integration.tmdb_enrichment": "Arricchimento TMDB: {state}",
    "settings.integration.tmdb_enrichment_desc": "Abilita arricchimento metadata da TMDB.",
    "settings.integration.tmdb_artwork": "Artwork TMDB: {state}",
    "settings.integration.tmdb_artwork_desc": "Usa poster/logo/sfondo da TMDB.",
    "settings.integration.tmdb_key": "Imposta API key TMDB",
    "settings.integration.tmdb_key_configured": "Chiave TMDB configurata.",
    "settings.integration.tmdb_key_missing": "Nessuna chiave TMDB configurata.",
    "settings.integration.tmdb_key_prompt": "Inserisci API key TMDB",
    "settings.integration.sync_pull_all": "Sync pull completo",
    "settings.integration.sync_pull_all_desc": "Scarica profili/plugin/addon/libreria/progressi.",
    "settings.integration.sync_push_all": "Sync push completo",
    "settings.integration.sync_push_all_desc": "Carica profili/plugin/addon/libreria/progressi.",

    "settings.language.current": "Lingua: {language}",
    "settings.language.current_desc": "Imposta la lingua app. Al primo avvio segue la lingua di sistema.",
    "settings.language.switch": "Passa a {language}",
    "settings.language.switch_desc": "Applica questa lingua all'interfaccia.",
    "settings.language.already_selected": "Lingua gia selezionata.",

    "settings.trakt.open_account": "Apri account",
    "settings.trakt.open_account_desc": "Gestisci Trakt dalla sezione account.",

    "settings.about.build": "Build Nuvio webOS",
    "settings.about.build_desc": "Modalita webOS completa (parita con Android).",
    "settings.about.privacy": "Privacy policy",
    "settings.about.privacy_desc": "Apri la pagina privacy.",

    "theme.apply_dark": "Applica tema scuro",
    "theme.apply_dark_desc": "Accento attuale: {accent}",
    "theme.apply_cinema": "Applica tema cinema",
    "theme.apply_cinema_desc": "Palette blu-nero a contrasto elevato.",
    "theme.accent_white": "Accento bianco",
    "theme.accent_white_desc": "Stile focus predefinito Android.",
    "theme.accent_crimson": "Accento cremisi",
    "theme.accent_crimson_desc": "Accento caldo ad alto contrasto.",
    "theme.accent_ocean": "Accento oceano",
    "theme.accent_ocean_desc": "Accento blu.",
    "theme.accent_violet": "Accento viola",
    "theme.accent_violet_desc": "Accento viola.",
    "theme.accent_emerald": "Accento smeraldo",
    "theme.accent_emerald_desc": "Accento verde.",
    "theme.accent_amber": "Accento ambra",
    "theme.accent_amber_desc": "Accento ambrato.",

    "playback.autoplay": "Autoplay prossimo: {state}",
    "playback.autoplay_desc": "Attiva/disattiva episodio successivo automatico.",
    "playback.subtitles": "Sottotitoli: {state}",
    "playback.subtitles_desc": "Attiva/disattiva sottotitoli predefiniti.",
    "playback.quality": "Qualita target: {quality}",
    "playback.quality_desc": "Ciclo Auto -> 2160p -> 1080p -> 720p.",
    "playback.quality_auto": "Auto",

    "home.context_select_title": "Seleziona un titolo",
    "home.context_pick_something": "Scorri le righe e scegli cosa guardare.",
    "home.context_row_home": "Home",
    "home.context_label_type": "Tipo",
    "home.context_label_year": "Anno",
    "home.context_label_score": "Voto",
    "home.see_all_in": "Vedi tutti in {row}",
    "home.see_all_titles": "Vedi tutti i titoli",
    "home.see_all_desc": "Apri la lista completa di questa riga.",
    "home.see_all": "Vedi tutti",
    "home.continue_watching": "Continua a guardare",
    "home.no_saved_progress": "Nessun progresso salvato.",
    "home.continue": "Continua",
    "home.minutes_left": "{value}m rimasti",
    "home.minutes_watched": "{value}m visti",

    "library.loading": "Caricamento libreria...",
    "library.no_saved_items": "Nessun elemento salvato.",
    "library.no_continue_items": "Nessun elemento in continua visione.",
    "library.title": "Libreria",
    "library.tab_all": "Tutti",
    "library.tab_movie": "Film",
    "library.tab_series": "Serie",
    "library.row_continue": "Continua a guardare",
    "library.row_saved": "Salvati",

    "search.loading": "Caricamento...",
    "search.no_results_title": "Nessun risultato",
    "search.no_results_desc": "Prova un'altra parola chiave.",
    "search.start_title": "Inizia una ricerca",
    "search.start_desc": "Inserisci almeno 2 caratteri.",
    "search.see_all": "Vedi tutti",
    "search.placeholder": "Cerca film e serie",
    "search.from_addon": "da {addon}",
    "search.default_addon": "Addon",

    "discover.title": "Scopri",
    "discover.filter_type": "Tipo",
    "discover.filter_catalog": "Catalogo",
    "discover.filter_genre": "Genere",
    "discover.default_genre": "Predefinito",
    "discover.no_catalog_selected": "Nessun catalogo selezionato",
    "discover.no_content": "Nessun contenuto trovato.",

    "stream.filter_all": "Tutti",
    "stream.source_suffix": "stream {addon}",
    "stream.card_stream": "Stream",
    "stream.loading_streams": "Caricamento stream...",
    "stream.no_streams_filter": "Nessuno stream trovato per questo filtro.",
    "stream.select_source_episode": "Seleziona una sorgente per avviare la riproduzione dell'episodio.",
    "stream.select_source_movie": "Seleziona una sorgente per avviare la riproduzione.",
    "stream.tag_torrent": "Torrent",
    "stream.tag_stream": "Stream",

    "catalog.fallback_title": "Catalogo",
    "catalog.no_items": "Nessun elemento disponibile.",
    "catalog.load_more": "Carica altro",
    "catalog.no_more": "Fine lista",

    "plugin.title": "Addon",
    "plugin.install_title": "Installa addon",
    "plugin.install_url_hint": "https://example.com",
    "plugin.manage_phone_title": "Gestisci da telefono",
    "plugin.manage_phone_desc": "Scansiona un codice QR per gestire addon e cataloghi Home dal telefono.",
    "plugin.reorder_title": "Riordina cataloghi Home",
    "plugin.reorder_desc": "Controlla l'ordine delle righe catalogo in Home (Classic + Modern + Grid).",
    "plugin.installed_title": "Installati",
    "plugin.empty_installed": "Nessun addon installato.",
    "plugin.unknown_addon": "Addon sconosciuto",
    "plugin.no_description": "Nessuna descrizione disponibile.",
    "plugin.prompt_install": "Installa URL addon",

    "account.loading": "Caricamento account...",
    "account.title": "Account",
    "account.sign_in_prompt": "Accedi per sincronizzare libreria e preferenze.",
    "account.sign_in": "Accedi",
    "account.sign_in_desc": "Usa il login QR da mobile.",
    "account.signed_in_as": "Connesso come",
    "account.user_default": "Utente",
    "account.sign_out": "Disconnetti",

    "auth_qr.sign_in_title": "Accedi con QR",
    "auth_qr.sign_in_desc": "Usa il telefono per accedere con email e password.",
    "auth_qr.account_login_title": "Login account",
    "auth_qr.account_login_desc": "Scansiona il QR, approva nel browser e torna qui.",
    "auth_qr.refresh": "Aggiorna QR",
    "auth_qr.enter_as_guest": "Entra come ospite",
    "auth_qr.continue_without_account": "Continua senza account",
    "auth_qr.code": "Codice: {code}",
    "auth_qr.expired": "Scaduto",
    "auth_qr.expires_in": "Scade tra {time}",
    "auth_qr.approved_finishing": "Approvato. Completamento login...",
    "auth_qr.qr_expired_retry": "QR scaduto. Aggiorna per riprovare.",
    "auth_qr.error_unavailable": "QR non disponibile. Riprova.",
    "auth_qr.error_invalid_redirect": "URL redirect backend QR non valido. Controlla setup SQL TV login.",
    "auth_qr.error_missing_function": "Funzione backend QR mancante. Riesegui setup SQL TV login.",
    "auth_qr.error_missing_extension": "Estensione backend QR mancante. Riesegui setup SQL TV login.",
    "auth_qr.error_invalid_caller_session": "Sessione QR non valida. Aggiorna il QR e riprova.",
    "auth_qr.error_network": "Errore di rete durante la generazione del QR.",
    "auth_qr.error_with_reason": "QR non disponibile: {reason}",

    "sync_code.title": "Codice sync",
    "sync_code.current": "Codice corrente: {value}",
    "sync_code.empty": "(vuoto)",
    "sync_code.set": "Imposta codice",
    "sync_code.clear": "Cancella codice",
    "sync_code.prompt": "Inserisci codice sync",

    "profile_selection.title": "Chi sta guardando?",
    "profile_selection.subtitle": "Seleziona un profilo per continuare.",
    "profile_selection.hint": "Usa il D-pad per scegliere un profilo.",
    "profile_selection.primary": "PRINCIPALE",

    "account_settings.loading": "Caricamento...",
    "account_settings.signed_out_desc": "Sincronizza libreria e preferenze tra dispositivi.",
    "account_settings.sign_in_qr": "Accedi con QR",
    "account_settings.sign_in_qr_desc": "Scansiona un codice QR per collegare questo dispositivo.",
    "account_settings.signed_in_as": "Connesso come",
    "account_settings.loading_overview": "Caricamento panoramica sync...",
    "account_settings.stat_addons": "addon",
    "account_settings.stat_plugins": "plugin",
    "account_settings.stat_library": "libreria",
    "account_settings.stat_progress": "progressi",
    "account_settings.stat_watched": "visti",

    "watched.badge": "Visto",
    "sidebar.navigation_title": "Navigazione",
    "sidebar.item": "Elemento",
  }
};

function resolveLanguage(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) {
    return null;
  }
  if (raw.startsWith("it")) {
    return "it";
  }
  if (raw.startsWith("en")) {
    return "en";
  }
  return null;
}

function titleCase(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

let currentLanguage = DEFAULT_LANGUAGE;

function interpolate(template, params) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(params || {}, key)) {
      const value = params[key];
      return value == null ? "" : String(value);
    }
    return "";
  });
}

function detectSystemLanguage() {
  const candidates = [];
  if (Array.isArray(globalThis.navigator?.languages)) {
    candidates.push(...globalThis.navigator.languages);
  }
  if (globalThis.navigator?.language) {
    candidates.push(globalThis.navigator.language);
  }
  for (const candidate of candidates) {
    const resolved = resolveLanguage(candidate);
    if (resolved) {
      return resolved;
    }
  }
  return DEFAULT_LANGUAGE;
}

function getTranslation(language, key) {
  const dict = TRANSLATIONS[language] || {};
  if (Object.prototype.hasOwnProperty.call(dict, key)) {
    return dict[key];
  }
  return undefined;
}

export const I18n = {

  init() {
    const stored = resolveLanguage(LocalStore.get(LANGUAGE_STORE_KEY, ""));
    if (stored) {
      currentLanguage = stored;
    } else {
      currentLanguage = detectSystemLanguage();
      LocalStore.set(LANGUAGE_STORE_KEY, currentLanguage);
    }
    globalThis.document?.documentElement?.setAttribute?.("lang", currentLanguage);
    return currentLanguage;
  },

  getLanguage() {
    return currentLanguage;
  },

  setLanguage(language) {
    const resolved = resolveLanguage(language) || DEFAULT_LANGUAGE;
    if (resolved === currentLanguage) {
      return false;
    }
    currentLanguage = resolved;
    LocalStore.set(LANGUAGE_STORE_KEY, currentLanguage);
    globalThis.document?.documentElement?.setAttribute?.("lang", currentLanguage);
    return true;
  },

  getSupportedLanguages() {
    return SUPPORTED_LANGUAGES.map((code) => ({
      code,
      label: this.t(code === "it" ? "language.italian" : "language.english")
    }));
  },

  getLanguageLabel(code) {
    const normalized = resolveLanguage(code) || DEFAULT_LANGUAGE;
    return this.t(normalized === "it" ? "language.italian" : "language.english");
  },

  t(key, params = {}) {
    const value = getTranslation(currentLanguage, key)
      ?? getTranslation(DEFAULT_LANGUAGE, key)
      ?? key;
    if (typeof value !== "string") {
      return String(key || "");
    }
    return interpolate(value, params);
  },

  formatContentType(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "movie") {
      return this.t("type.movie");
    }
    if (normalized === "series") {
      return this.t("type.series");
    }
    if (normalized === "tv") {
      return this.t("type.tv");
    }
    if (normalized === "catalog") {
      return this.t("type.catalog");
    }
    return titleCase(normalized);
  },

  formatOnOff(value) {
    return value ? this.t("common.on") : this.t("common.off");
  }

};
