import SwiftUI

/// The big at-a-glance summary at the top of the report.
struct HeroCardView: View {
    let report: PlantReport

    private var headline: (eyebrow: String, title: String, sub: String) {
        let c = report.counts
        if c.needsWater == 0 && c.tooWet == 0 && c.missing == 0 {
            return ("ALL SET", "Garden looks happy.",
                    "All \(c.good) plants in their ideal range.")
        }
        if c.needsWater > 0 {
            let dry = report.readings
                .filter(\.needsWater)
                .sorted { ($0.idealLow - Int($0.moisture ?? 0)) > ($1.idealLow - Int($1.moisture ?? 0)) }
            let names = dry.prefix(3).map(\.name).joined(separator: ", ")
            let more = dry.count > 3 ? " +\(dry.count - 3) more" : ""
            return ("ACTION NEEDED",
                    "\(c.needsWater) plant\(c.needsWater == 1 ? "" : "s") need\(c.needsWater == 1 ? "s" : "") water",
                    names + more)
        }
        if c.tooWet > 0 {
            let names = report.readings.filter { $0.status == .tooWet }.map(\.name).joined(separator: ", ")
            return ("HEADS UP",
                    "\(c.tooWet) plant\(c.tooWet == 1 ? "" : "s") too wet",
                    names)
        }
        return ("HEADS UP",
                "\(c.missing) sensor\(c.missing == 1 ? "" : "s") not reporting",
                "Check the affected gateway.")
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Background gradient + decorative blob
            RoundedRectangle(cornerRadius: DS.heroRadius, style: .continuous)
                .fill(LinearGradient(colors: [DS.brand, DS.brandLight],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(
                    Circle()
                        .fill(Color.white.opacity(0.08))
                        .frame(width: 280, height: 280)
                        .offset(x: 140, y: 120)
                        .clipShape(RoundedRectangle(cornerRadius: DS.heroRadius, style: .continuous))
                )

            VStack(alignment: .leading, spacing: 8) {
                Text(headline.eyebrow)
                    .font(.system(size: 11.5, weight: .semibold))
                    .tracking(1.6)
                    .foregroundStyle(.white.opacity(0.85))

                Text(headline.title)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)

                Text(headline.sub)
                    .font(.system(size: 14.5))
                    .foregroundStyle(.white.opacity(0.92))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)

                if report.weather.available {
                    VStack(alignment: .leading, spacing: 6) {
                        WeatherChip(weather: report.weather)
                        if let alert = heatAlert(for: report.weather) {
                            HeatAlertChip(text: alert)
                        }
                    }
                    .padding(.top, 12)
                }

                StatRow(counts: report.counts)
                    .padding(.top, 16)
            }
            .padding(20)
        }
        .shadow(color: .black.opacity(0.12), radius: 20, x: 0, y: 8)
    }
}

private func heatAlert(for w: Weather) -> String? {
    let today = w.highTodayF
    let p5 = w.maxHigh5dayF
    let p7 = w.maxHigh7dayF
    if w.severeHeatComing == true, let p = p5 { return "🔥 Severe heat — peak \(p)°F within 5 days" }
    if w.heatwaveComing == true,   let p = p5 { return "🌡️ Heat coming — peak \(p)°F within 5 days" }
    if let p = p7, let t = today, p >= 88, p - t >= 8 { return "🌡️ Heat ahead — peak \(p)°F within a week" }
    return nil
}

private struct HeatAlertChip: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 12).padding(.vertical, 7)
            .background(Color(red: 1.0, green: 0.74, blue: 0.2).opacity(0.30), in: Capsule())
            .overlay(Capsule().strokeBorder(Color(red: 1.0, green: 0.74, blue: 0.2).opacity(0.6), lineWidth: 1))
    }
}

private struct WeatherChip: View {
    let weather: Weather
    var body: some View {
        let parts: [String] = {
            var p: [String] = []
            // Prefer server-converted inches; fall back to mm conversion
            let inches: Double? = weather.rainSoonIn ?? weather.rainSoonMm.map { $0 / 25.4 }
            if let i = inches {
                p.append(i >= 0.1 ? String(format: "~%.1f\" rain next 2 days", i) : "Little to no rain")
            }
            // Prefer server-converted °F; fall back to °C conversion
            let f: Int? = weather.highTodayF ?? weather.highTodayC.map { Int(($0 * 9/5 + 32).rounded()) }
            if let f = f { p.append("\(f)°F high today") }
            return p
        }()
        HStack(spacing: 6) {
            Image(systemName: "cloud.fill")
                .font(.system(size: 11, weight: .semibold))
            Text(parts.joined(separator: " · "))
                .font(.system(size: 13, weight: .medium))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 12).padding(.vertical, 7)
        .background(.ultraThinMaterial.opacity(0.4), in: Capsule())
        .background(Color.white.opacity(0.15), in: Capsule())
    }
}

private struct StatRow: View {
    let counts: Counts
    var body: some View {
        HStack(spacing: 18) {
            stat(value: counts.needsWater, label: "NEED WATER")
            stat(value: counts.tooWet,     label: "TOO WET")
            stat(value: counts.good,       label: "DOING FINE")
            if counts.deferred > 0 { stat(value: counts.deferred, label: "RAIN COMING") }
            if counts.missing  > 0 { stat(value: counts.missing,  label: "OFFLINE")     }
        }
    }
    private func stat(value: Int, label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(value)")
                .font(.system(size: 22, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(.white)
            Text(label)
                .font(.system(size: 10.5, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(.white.opacity(0.85))
        }
    }
}
