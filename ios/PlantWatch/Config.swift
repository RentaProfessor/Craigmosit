import Foundation

/// Backend configuration for the PlantWatch iOS client.
enum Config {
    static let supabaseUrl = "https://naaqvzbezcqamhqqnotx.supabase.co"
    static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hYXF2emJlemNxYW1ocXFub3R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDQ2MzksImV4cCI6MjA5NTMyMDYzOX0.T3dkVfOR09GunHSL1l2BhaQHRX9icS56e29OiiqvI24"

    /// Authenticated per-user report (requires sign-in).
    static let endpoint = URL(string: "\(supabaseUrl)/functions/v1/report-v2")!

    /// Auto-refresh while the app is foregrounded.
    static let autoRefreshInterval: TimeInterval = 60
}
