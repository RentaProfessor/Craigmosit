import Foundation

@MainActor
final class PlantReportService: ObservableObject {
    @Published var report:   PlantReport?
    @Published var error:    String?
    @Published var loading:  Bool = false

    func load() async {
        loading = true
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
                throw NSError(domain: "PlantWatch", code: -1, userInfo: [
                    NSLocalizedDescriptionKey: "Backend returned an error.",
                ])
            }
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            self.report = try decoder.decode(PlantReport.self, from: data)
            self.error = nil
        } catch {
            self.error = error.localizedDescription
            self.report = nil
        }
    }
}
