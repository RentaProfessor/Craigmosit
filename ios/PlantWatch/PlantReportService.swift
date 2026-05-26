import Foundation
import Combine

@MainActor
final class PlantReportService: ObservableObject {
    @Published private(set) var report:  PlantReport?
    @Published private(set) var error:   String?
    @Published private(set) var loading: Bool = false
    @Published private(set) var lastLoaded: Date?

    private var refreshTask: Task<Void, Never>?

    func load(silent: Bool = false) async {
        if !silent { loading = true }
        defer { loading = false }
        do {
            var req = URLRequest(url: Config.endpoint)
            req.cachePolicy = .reloadIgnoringLocalCacheData
            if let key = Config.anonKey {
                req.setValue(key, forHTTPHeaderField: "apikey")
                req.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
            }
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let parsed = try decoder.decode(PlantReport.self, from: data)
            self.report = parsed
            self.error = nil
            self.lastLoaded = Date()
        } catch {
            self.error = humanize(error)
            if self.report == nil { /* preserve previous data on transient failures */ }
        }
    }

    func startAutoRefresh() {
        refreshTask?.cancel()
        refreshTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(Config.autoRefreshInterval * 1_000_000_000))
                await self?.load(silent: true)
            }
        }
    }

    func stopAutoRefresh() { refreshTask?.cancel() }

    private func humanize(_ error: Error) -> String {
        if let e = error as? URLError {
            switch e.code {
            case .notConnectedToInternet: return "No internet connection."
            case .timedOut:               return "Connection timed out — try again."
            case .badServerResponse:      return "Backend isn't responding correctly."
            default:                      return e.localizedDescription
            }
        }
        return error.localizedDescription
    }
}
