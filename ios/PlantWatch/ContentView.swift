import SwiftUI

/// Physical-zone filter applied on the dashboard.
enum ZoneFilter: String, CaseIterable, Identifiable {
    case all       = "All"
    case backYard  = "Back Yard"
    case sideYards = "Side Yards"
    var id: String { rawValue }
}

enum LayoutMode: String, CaseIterable, Identifiable {
    case grid = "Grid"
    case list = "List"
    var id: String { rawValue }
}

struct ContentView: View {
    @StateObject private var svc = PlantReportService()
    @State private var nowTick = Date()
    @State private var filter: ZoneFilter = .all
    @AppStorage("pw-layout") private var layoutRaw: String = LayoutMode.grid.rawValue
    @State private var infoReading: Reading?    // currently presented in the sheet
    private var layout: LayoutMode {
        get { LayoutMode(rawValue: layoutRaw) ?? .grid }
    }
    private let tickTimer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            ZStack {
                Color(.systemGroupedBackground).ignoresSafeArea()

                Group {
                    if let report = svc.report {
                        ReportScrollView(
                            report: report, lastLoaded: svc.lastLoaded, nowTick: nowTick,
                            filter: $filter, layoutRaw: $layoutRaw,
                            onInfoTap: { infoReading = $0 }
                        )
                    } else if svc.loading {
                        LoadingView()
                    } else if let err = svc.error {
                        ErrorView(message: err) {
                            Task { await svc.load() }
                        }
                    } else {
                        LoadingView()
                    }
                }
                .sheet(item: $infoReading) { reading in
                    InfoSheet(reading: reading)
                        .presentationDetents([.medium, .large])
                        .presentationDragIndicator(.visible)
                }
            }
            .navigationTitle("Craig PlantWatch")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    RefreshButton(loading: svc.loading) {
                        Task { await svc.load() }
                    }
                }
            }
            .refreshable { await svc.load() }
        }
        .task {
            await svc.load()
            svc.startAutoRefresh()
        }
        .onReceive(tickTimer) { _ in nowTick = Date() }
    }
}

// MARK: – Report scroll view

private struct ReportScrollView: View {
    let report: PlantReport
    let lastLoaded: Date?
    let nowTick: Date
    @Binding var filter: ZoneFilter
    @Binding var layoutRaw: String
    let onInfoTap: (Reading) -> Void

    /// Group by physical_zone (Back Yard / Front Yard) instead of gateway.
    private var zones: [(zone: String, readings: [Reading])] {
        let g = Dictionary(grouping: report.readings) { $0.physicalZone ?? $0.zone }
        return ["Back Yard", "Side Yards"].compactMap { z in
            guard filter == .all || filter.rawValue == z else { return nil }
            return g[z].map { (zone: z, readings: $0.sorted {
                if $0.zone != $1.zone { return $0.zone < $1.zone }
                return ($0.displayOrder ?? $0.channel) < ($1.displayOrder ?? $1.channel)
            })}
        }
    }

    private var zoneCounts: [ZoneFilter: Int] {
        let g = Dictionary(grouping: report.readings) { $0.physicalZone ?? $0.zone }
        return [
            .all:       report.readings.count,
            .backYard:  (g["Back Yard"]  ?? []).count,
            .sideYards: (g["Side Yards"] ?? []).count,
        ]
    }

    private var layout: LayoutMode { LayoutMode(rawValue: layoutRaw) ?? .grid }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let t = lastLoaded {
                    Text("Updated \(t.relative(to: nowTick))")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                        .id(nowTick)        // re-render with fresh tick
                }

                HeroCardView(report: report)

                HStack(spacing: 12) {
                    ZoneFilterRow(filter: $filter, counts: zoneCounts)
                    LayoutToggle(layoutRaw: $layoutRaw)
                }

                ForEach(zones, id: \.zone) { group in
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text(group.zone.uppercased())
                                .font(.system(size: 12.5, weight: .semibold))
                                .tracking(1.5)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text("\(group.readings.count) plants")
                                .font(.system(size: 12))
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                        .padding(.horizontal, 4)
                        .padding(.top, 8)

                        if layout == .grid {
                            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12),
                                                GridItem(.flexible(), spacing: 12)], spacing: 12) {
                                ForEach(group.readings) { r in
                                    PlantCardView(reading: r, onInfoTap: { onInfoTap(r) })
                                }
                            }
                        } else {
                            LazyVStack(spacing: 10) {
                                ForEach(group.readings) { r in
                                    PlantCardView(reading: r, onInfoTap: { onInfoTap(r) })
                                }
                            }
                        }
                    }
                }

                ForEach(report.pairNotes.sorted(by: { $0.key < $1.key }), id: \.key) { k, v in
                    PairNoteView(pairName: k, note: v)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 30)
        }
    }
}

// MARK: – Smaller pieces

/// Compact two-button segmented control for the layout mode.
private struct LayoutToggle: View {
    @Binding var layoutRaw: String
    private var layout: LayoutMode {
        get { LayoutMode(rawValue: layoutRaw) ?? .grid }
    }
    var body: some View {
        HStack(spacing: 2) {
            button(.grid, system: "square.grid.2x2")
            button(.list, system: "list.bullet")
        }
        .padding(3)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(.separator.opacity(0.5)))
    }
    private func button(_ m: LayoutMode, system: String) -> some View {
        let on = layout == m
        return Button { layoutRaw = m.rawValue } label: {
            Image(systemName: system)
                .font(.system(size: 12, weight: .semibold))
                .frame(width: 30, height: 24)
                .background(on ? AnyView(Capsule().fill(DS.brand)) : AnyView(Color.clear))
                .foregroundStyle(on ? Color.white : Color.secondary)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

/// Sheet shown when the info (i) button is tapped on a card.
private struct InfoSheet: View {
    let reading: Reading
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 12) {
                    Text(DS.emoji(for: reading.name, type: reading.type))
                        .font(.system(size: 36))
                        .frame(width: 56, height: 56)
                        .background(Color(.tertiarySystemGroupedBackground),
                                    in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(reading.name).font(.title3.bold())
                        Text("CH\(reading.channel) · ideal \(reading.idealLow)–\(reading.idealHigh)%")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(reading.headline.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.5)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .foregroundStyle(reading.status.tint)
                        .background(reading.status.tint.opacity(0.16), in: Capsule())
                }

                if let why = reading.ratingExplanation {
                    sec("Why this rating", body: why)
                }
                if let rec = reading.wateringRecommendation {
                    sec("Suggested watering", body: rec)
                } else if reading.status == .good {
                    sec("Suggested watering", body: "None — in range.")
                }
                if let note = reading.speciesNote {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("WHY \(reading.species.uppercased()) NEEDS THIS RANGE")
                            .font(.system(size: 11, weight: .semibold))
                            .tracking(0.6)
                            .foregroundStyle(.secondary)
                        Text(note)
                            .font(.subheadline)
                            .foregroundStyle(.primary)
                            .fixedSize(horizontal: false, vertical: true)
                        if let label = reading.sourceLabel, let urlStr = reading.sourceUrl, let url = URL(string: urlStr) {
                            Link(destination: url) {
                                HStack(spacing: 4) {
                                    Image(systemName: "link")
                                        .font(.system(size: 10, weight: .semibold))
                                    Text("Source: \(label)")
                                        .font(.caption)
                                }
                                .foregroundStyle(DS.brandLight)
                                .padding(.top, 2)
                            }
                        }
                    }
                }
            }
            .padding(20)
        }
        .presentationDetents([.medium, .large])
    }
    private func sec(_ label: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(.secondary)
            Text(body)
                .font(.subheadline)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Horizontal pill row to filter the report by physical zone.
private struct ZoneFilterRow: View {
    @Binding var filter: ZoneFilter
    let counts: [ZoneFilter: Int]
    var body: some View {
        HStack(spacing: 8) {
            ForEach(ZoneFilter.allCases) { z in
                Button {
                    withAnimation(.easeOut(duration: 0.18)) { filter = z }
                } label: {
                    HStack(spacing: 8) {
                        Text(z.rawValue)
                            .font(.system(size: 13.5, weight: .medium))
                        Text("\(counts[z] ?? 0)")
                            .font(.system(size: 11, weight: .semibold))
                            .monospacedDigit()
                            .padding(.horizontal, 7).padding(.vertical, 1)
                            .background(
                                (filter == z ? Color.white.opacity(0.22) : Color(.tertiarySystemGroupedBackground)),
                                in: Capsule()
                            )
                    }
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(
                        filter == z
                          ? AnyView(Capsule().fill(DS.brand))
                          : AnyView(Capsule().fill(Color(.secondarySystemGroupedBackground)).overlay(Capsule().stroke(.separator.opacity(0.5))))
                    )
                    .foregroundStyle(filter == z ? Color.white : Color(.label))
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }
}

private struct RefreshButton: View {
    let loading: Bool
    let action: () -> Void
    @State private var rot: Double = 0

    var body: some View {
        Button(action: action) {
            Image(systemName: "arrow.clockwise")
                .font(.system(size: 16, weight: .semibold))
                .rotationEffect(.degrees(rot))
                .animation(loading ? .linear(duration: 0.8).repeatForever(autoreverses: false)
                                   : .default, value: rot)
        }
        .disabled(loading)
        .onChange(of: loading) { _, l in rot = l ? rot + 360 : 0 }
    }
}

private struct PairNoteView: View {
    let pairName: String
    let note: String
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text("🥑").font(.system(size: 22))
            VStack(alignment: .leading, spacing: 2) {
                Text("\(pairName.capitalized) probe pair")
                    .font(.system(size: 13, weight: .semibold))
                Text(note)
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: DS.cardRadius, style: .continuous)
                .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                .foregroundStyle(.separator)
        )
    }
}

private struct LoadingView: View {
    var body: some View {
        VStack(spacing: 14) {
            ProgressView().controlSize(.large).tint(DS.brand)
            Text("Fetching latest readings…")
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct ErrorView: View {
    let message: String
    let onRetry: () -> Void
    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 36))
                .foregroundStyle(DS.bad.opacity(0.8))
            Text("Couldn't load the report")
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 30)
            Button("Try again", action: onRetry)
                .buttonStyle(.borderedProminent)
                .tint(DS.brand)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    ContentView()
}
