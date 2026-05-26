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
    let rainSoonMm:        Double?
    let rainSoonIn:        Double?
    let rain7dayIn:        Double?
    let highTodayC:        Double?
    let highTodayF:        Int?
    let maxHigh3dayF:      Int?
    let maxHigh3dayDay:    String?
    let maxHigh5dayF:      Int?
    let maxHigh5dayDay:    String?
    let maxHigh7dayF:      Int?
    let maxHigh7dayDay:    String?
    let heatwaveComing:    Bool?
    let severeHeatComing:  Bool?
    let forecastHorizonDays: Int?
    let minHumidityToday:  Double?
    let et0TodayIn:        Double?
    let available:         Bool

    enum CodingKeys: String, CodingKey {
        case rainSoonMm       = "rain_soon_mm"
        case rainSoonIn       = "rain_soon_in"
        case rain7dayIn       = "rain_7day_in"
        case highTodayC       = "high_today_c"
        case highTodayF       = "high_today_f"
        case maxHigh3dayF     = "max_high_3day_f"
        case maxHigh3dayDay   = "max_high_3day_day"
        case maxHigh5dayF     = "max_high_5day_f"
        case maxHigh5dayDay   = "max_high_5day_day"
        case maxHigh7dayF     = "max_high_7day_f"
        case maxHigh7dayDay   = "max_high_7day_day"
        case heatwaveComing   = "heatwave_coming"
        case severeHeatComing = "severe_heat_coming"
        case forecastHorizonDays = "forecast_horizon_days"
        case minHumidityToday = "min_humidity_today"
        case et0TodayIn       = "et0_today_in"
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

struct Adjustment: Decodable, Hashable {
    let delta:  String   // e.g. "+5%" or "−2%"
    let reason: String   // e.g. "91°F tomorrow (heat-sensitive species)"
}

struct Reading: Decodable, Identifiable {
    var id: String { "\(zone)-\(channel)" }

    let zone:          String
    let channel:       Int
    let displayOrder:  Int?
    let name:          String
    let type:          String
    let verified:      Bool
    let pair:          String?
    let pairRole:      String?

    // Weather-adjusted band (today). What the dashboard uses for status.
    let idealLow:      Int
    let idealHigh:     Int
    // Species base band (research-backed, unmoved by weather).
    let baseLow:       Int?
    let baseHigh:      Int?
    // List of adjustments applied to lift/lower the floor today.
    let adjustments:   [Adjustment]?

    let moisture:      Double?
    let battery:       Double?
    let status:        Status
    let headline:      String
    let advice:        String
    let needsWater:    Bool

    enum CodingKeys: String, CodingKey {
        case zone, channel, name, type, verified, pair, moisture, battery, status, headline, advice, adjustments
        case displayOrder = "display_order"
        case pairRole     = "pair_role"
        case idealLow     = "ideal_low"
        case idealHigh    = "ideal_high"
        case baseLow      = "base_low"
        case baseHigh     = "base_high"
        case needsWater   = "needs_water"
    }

    /// True when the weather has shifted the ideal floor away from the species base.
    var rangeAdjusted: Bool {
        guard let bl = baseLow else { return false }
        return bl != idealLow
    }
}
