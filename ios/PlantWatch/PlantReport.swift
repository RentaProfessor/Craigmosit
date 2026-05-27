import Foundation

struct PlantReport: Decodable {
    let generatedAt: Date
    let weather: Weather
    var counts: Counts
    let pairNotes: [String: String]
    var readings: [Reading]

    enum CodingKeys: String, CodingKey {
        case generatedAt = "generated_at"
        case weather, counts, readings
        case pairNotes  = "pair_notes"
    }

    /// Apply user overrides + recompute counts so the rest of the UI sees the new world.
    @MainActor
    func applying(_ prefs: Preferences) -> PlantReport {
        var copy = self
        copy.readings = readings.map { prefs.applyOverride($0) }
        copy.counts = Counts(
            needsWater: copy.readings.filter { $0.needsWater }.count,
            tooWet:     copy.readings.filter { $0.status == .tooWet }.count,
            good:       copy.readings.filter { $0.status == .good }.count,
            missing:    copy.readings.filter { $0.status == .noReading }.count
        )
        return copy
    }
}

struct Weather: Decodable {
    let tempNowF:          Int?
    let humidityNow:       Int?
    let highTodayF:        Int?
    let lowTodayF:         Int?
    let minHumidityToday:  Int?
    let rainTodayIn:       Double?
    let highTomorrowF:     Int?
    let rainTomorrowIn:    Double?
    let available:         Bool

    enum CodingKeys: String, CodingKey {
        case tempNowF         = "temp_now_f"
        case humidityNow      = "humidity_now"
        case highTodayF       = "high_today_f"
        case lowTodayF        = "low_today_f"
        case minHumidityToday = "min_humidity_today"
        case rainTodayIn      = "rain_today_in"
        case highTomorrowF    = "high_tomorrow_f"
        case rainTomorrowIn   = "rain_tomorrow_in"
        case available
    }
}

struct Counts: Decodable {
    let needsWater: Int
    let tooWet:     Int
    let good:       Int
    let missing:    Int

    enum CodingKeys: String, CodingKey {
        case needsWater = "needs_water"
        case tooWet     = "too_wet"
        case good, missing
    }

    init(needsWater: Int, tooWet: Int, good: Int, missing: Int) {
        self.needsWater = needsWater
        self.tooWet = tooWet
        self.good = good
        self.missing = missing
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        needsWater = try c.decode(Int.self, forKey: .needsWater)
        tooWet     = try c.decode(Int.self, forKey: .tooWet)
        good       = try c.decode(Int.self, forKey: .good)
        missing    = try c.decode(Int.self, forKey: .missing)
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

    let zone:                  String     // gateway name (Back Yard / Side Yards)
    let channel:               Int
    let displayOrder:          Int?
    let physicalZone:          String?    // physical location (Back Yard / Front Yard)
    let physicalZoneVerified:  Bool?
    let name:                  String
    let type:                  String
    let species:               String      // species key — same as `type`, kept for clarity
    let verified:              Bool
    let pair:                  String?
    let pairRole:              String?

    // Static research-backed ideal band — mutable so client-side overrides can replace it.
    var idealLow:      Int
    var idealHigh:     Int

    let moisture:               Double?
    let battery:                Double?
    var status:                 Status
    var headline:               String
    let advice:                 String
    let speciesNote:            String?
    let sourceLabel:            String?
    let sourceUrl:              String?
    var needsWater:             Bool
    let ratingExplanation:      String?
    let wateringRecommendation: String?
    let wateringTargetPct:      Int?
    /// True if the user has set a custom range overriding the species default.
    var customRange:            Bool = false

    enum CodingKeys: String, CodingKey {
        case zone, channel, name, type, species, verified, pair, moisture, battery, status, headline, advice
        case displayOrder            = "display_order"
        case physicalZone            = "physical_zone"
        case physicalZoneVerified    = "physical_zone_verified"
        case pairRole                = "pair_role"
        case idealLow                = "ideal_low"
        case idealHigh               = "ideal_high"
        case speciesNote             = "species_note"
        case sourceLabel             = "source_label"
        case sourceUrl               = "source_url"
        case needsWater              = "needs_water"
        case ratingExplanation       = "rating_explanation"
        case wateringRecommendation  = "watering_recommendation"
        case wateringTargetPct       = "watering_target_pct"
    }
}
