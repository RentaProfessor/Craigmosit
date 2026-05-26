import SwiftUI

struct ContentView: View {
    @StateObject private var svc = PlantReportService()
    @State private var nowTick = Date()
    private let tickTimer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            ZStack {
                Color(.systemGroupedBackground).ignoresSafeArea()

                Group {
                    if let report = svc.report {
                        ReportScrollView(report: report, lastLoaded: svc.lastLoaded, nowTick: nowTick)
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
            }
            .navigationTitle("PlantWatch")
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

    private var zones: [(zone: String, readings: [Reading])] {
        let g = Dictionary(grouping: report.readings, by: \.zone)
        return ["Back Yard", "Side Yards"].compactMap { z in
            g[z].map { (zone: z, readings: $0.sorted { $0.channel < $1.channel }) }
        }
    }

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

                        LazyVStack(spacing: 12) {
                            ForEach(group.readings) { PlantCardView(reading: $0) }
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
