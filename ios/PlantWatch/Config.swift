import Foundation

/// Backend configuration for the PlantWatch iOS client.
///
/// The app talks to the Supabase edge function — never to Ecowitt directly,
/// so no API keys are ever shipped inside the app bundle.
enum Config {
    /// Full URL to the deployed `plant-report` edge function.
    static let endpoint = URL(string: "https://naaqvzbezcqamhqqnotx.supabase.co/functions/v1/plant-report")!

    /// Supabase anon key. Not required — the function is deployed with
    /// `verify_jwt = false` (single trusted audience per spec).
    static let anonKey: String? = nil

    /// Auto-refresh while the app is foregrounded.
    static let autoRefreshInterval: TimeInterval = 60
}
