import SwiftUI

struct ContentView: View {
    @StateObject private var svc = PlantReportService()

    var body: some View {
        NavigationStack {
            Group {
                if let r = svc.report {
                    ReportView(report: r)
                } else if let e = svc.error {
                    ContentUnavailableView(
                        "Couldn't load the report",
                        systemImage: "exclamationmark.triangle",
                        description: Text(e)
                    )
                } else {
                    ProgressView("Fetching latest readings…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle("🌱 PlantWatch")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { Task { await svc.load() } } label: {
                        if svc.loading { ProgressView() } else { Image(systemName: "arrow.clockwise") }
                    }
                    .disabled(svc.loading)
                }
            }
            .refreshable { await svc.load() }
        }
        .task { await svc.load() }
    }
}

private struct ReportView: View {
    let report: PlantReport

    private var zones: [(zone: String, readings: [Reading])] {
        let grouped = Dictionary(grouping: report.readings, by: \.zone)
        let order = ["Back Yard", "Side Yards"]
        return order.compactMap { z in
            grouped[z].map { (zone: z, readings: $0.sorted { $0.channel < $1.channel }) }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                MetaHeader(report: report)
                if report.weather.available { WeatherBanner(weather: report.weather) }
                SummaryPills(counts: report.counts)

                ForEach(zones, id: \.zone) { group in
                    Section {
                        VStack(spacing: 10) {
                            ForEach(group.readings) { PlantCard(reading: $0) }
                        }
                    } header: {
                        Text(group.zone.uppercased())
                            .font(.caption).fontWeight(.semibold)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.top, 4)
                    }
                }

                ForEach(report.pairNotes.sorted(by: { $0.key < $1.key }), id: \.key) { (k, v) in
                    Text("Paired-probe note (\(k)): \(v)")
                        .font(.footnote)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.quaternary, in: RoundedRectangle(cornerRadius: 10))
                }
            }
            .padding(16)
        }
    }
}

private struct MetaHeader: View {
    let report: PlantReport
    var body: some View {
        Text("Last read \(report.generatedAt.formatted(date: .complete, time: .shortened))")
            .font(.footnote).foregroundStyle(.secondary)
    }
}

private struct WeatherBanner: View {
    let weather: Weather
    var body: some View {
        var pieces: [String] = []
        if let r = weather.rainSoonMm {
            pieces.append(r >= 1
                ? "~\(Int(r.rounded()))mm rain expected next 2 days"
                : "little to no rain expected")
        }
        if let t = weather.highTodayC {
            pieces.append("high \(Int(t.rounded()))°C")
        }
        return Text("Weather: \(pieces.joined(separator: " · "))")
            .font(.footnote)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.quaternary, in: RoundedRectangle(cornerRadius: 10))
    }
}

private struct SummaryPills: View {
    let counts: Counts
    var body: some View {
        let pills: [(label: String, tint: Color)] = [
            counts.needsWater > 0 ? ("\(counts.needsWater) need water",      .red)    : nil,
            counts.deferred  > 0  ? ("\(counts.deferred) dry but rain's coming", .orange) : nil,
            counts.tooWet    > 0  ? ("\(counts.tooWet) too wet",             .blue)   : nil,
            counts.good      > 0  ? ("\(counts.good) doing fine",            .green)  : nil,
            counts.missing   > 0  ? ("\(counts.missing) not reporting",      .gray)   : nil,
        ].compactMap { $0 }

        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(pills, id: \.label) { p in
                    Text(p.label)
                        .font(.caption)
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(p.tint.opacity(0.15), in: Capsule())
                        .foregroundStyle(p.tint)
                }
            }
        }
    }
}

private struct PlantCard: View {
    let reading: Reading
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(reading.name).font(.headline)
                if !reading.verified {
                    Text("unverified")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }
                Spacer()
                StatusBadge(status: reading.status, headline: reading.headline)
            }
            HStack(spacing: 8) {
                Text("\(reading.zone) · CH\(reading.channel)")
                if let b = reading.battery { Text("· 🔋 \(b, specifier: "%.1f")V") }
            }
            .font(.caption).foregroundStyle(.secondary)

            if let m = reading.moisture {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(Int(m.rounded()))").font(.system(size: 30, weight: .bold))
                    Text("%").foregroundStyle(.secondary)
                }
                MoistureBar(value: m, idealLow: reading.idealLow, idealHigh: reading.idealHigh)
                Text("Ideal \(reading.idealLow)–\(reading.idealHigh)% · \(reading.type)\(reading.pairRole.map { " · \($0) probe" } ?? "")")
                    .font(.caption).foregroundStyle(.secondary)
            } else {
                Text("no reading").foregroundStyle(.secondary)
            }
            Text(reading.advice).font(.subheadline)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(.separator))
    }
}

private struct MoistureBar: View {
    let value: Double
    let idealLow: Int
    let idealHigh: Int
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let lowX  = w * CGFloat(idealLow)  / 100
            let highX = w * CGFloat(idealHigh) / 100
            let valX  = w * CGFloat(min(max(value, 0), 100)) / 100
            ZStack(alignment: .leading) {
                Capsule().fill(.quaternary)
                Rectangle()
                    .fill(.green.opacity(0.20))
                    .frame(width: highX - lowX, height: 6)
                    .offset(x: lowX)
                    .clipShape(Capsule())
                Rectangle()
                    .fill(.green)
                    .frame(width: 2, height: 12)
                    .offset(x: valX - 1, y: -3)
            }
        }
        .frame(height: 6)
    }
}

private struct StatusBadge: View {
    let status: Status
    let headline: String
    var body: some View {
        Text(headline.uppercased())
            .font(.caption2).fontWeight(.semibold)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }
    private var color: Color {
        switch status {
        case .good:              return .green
        case .goodHotWarning:    return .orange
        case .dry, .veryDry:     return .red
        case .dryRainComing:     return .orange
        case .tooWet:            return .blue
        case .noReading:         return .gray
        }
    }
}
