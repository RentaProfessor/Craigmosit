import Foundation

/// Backend configuration for the PlantWatch iOS client.
///
/// The app talks to the Supabase edge function — never to Ecowitt directly,
/// so no API keys are ever shipped inside the app bundle.
enum Config {
    /// Full URL to the deployed `plant-report` edge function, e.g.
    /// `https://abcdefgh.supabase.co/functions/v1/plant-report`.
    static let endpoint = URL(string: "https://YOUR-PROJECT.supabase.co/functions/v1/plant-report")!

    /// Supabase anon key. Public token — safe to ship in a client build.
    /// Required unless the function is configured with `verify_jwt = false`.
    static let anonKey: String? = nil
}
