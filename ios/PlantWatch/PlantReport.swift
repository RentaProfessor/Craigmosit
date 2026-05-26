import Foundation

struct PlantReport: Decodable {
    let generatedAt: Date
    let weather: Weather
    let counts: Counts
    let pairNotes: [String: String]
    let readings: [Reading]

    enum CodingKeys: String, CodingKey {
        case generatedAt = "generated_at"
        case weather, counts, readings
        case pairNotes  = "pair_notes"
    }
}

struct Weather: Decodable {
    let rainSoonMm: Double?
    let highTodayC: Double?
    let rainSkipThresholdMm: Double
    let available: Bool

    enum CodingKeys: String, CodingKey {
        case rainSoonMm           = "rain_soon_mm"
        case highTodayC           = "high_today_c"
        case rainSkipThresholdMm  = "rain_skip_threshold_mm"
        case available
    }
}

struct Counts: Decodable {
    let needsWater: Int
    let tooWet:     Int
    let good:       Int
    let deferred:   Int
    let missing:    Int

    enum CodingKeys: String, CodingKey {
        case needsWater = "needs_water"
        case tooWet     = "too_wet"
        case good, deferred, missing
    }
}

enum Status: String, Decodable {
    case veryDry         = "very_dry"
    case dry
    case dryRainComing   = "dry_rain_coming"
    case good
    case goodHotWarning  = "good_hot_warning"
    case tooWet          = "too_wet"
    case noReading       = "no_reading"
}

struct Reading: Decodable, Identifiable {
    var id: String { "\(zone)-\(channel)" }

    let zone:      String
    let channel:   Int
    let name:      String
    let type:      String
    let verified:  Bool
    let pair:      String?
    let pairRole:  String?
    let idealLow:  Int
    let idealHigh: Int
    let moisture:  Double?
    let battery:   Double?
    let status:    Status
    let headline:  String
    let advice:    String
    let needsWater: Bool

    enum CodingKeys: String, CodingKey {
        case zone, channel, name, type, verified, pair, moisture, battery, status, headline, advice
        case pairRole   = "pair_role"
        case idealLow   = "ideal_low"
        case idealHigh  = "ideal_high"
        case needsWater = "needs_water"
    }
}
