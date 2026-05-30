import Foundation
import SwiftUI
import UserNotifications

/// Local-only preferences: per-plant moisture overrides + notification choices.
@MainActor
final class Preferences: ObservableObject {
    static let shared = Preferences()

    @Published var overrides:     [String: Override] = [:]
    @Published var zoneOverrides: [String: String]  = [:]   // id → "Back Yard" / "Side Yards" / "Front Yard"
    @Published var notifyMode:    NotifyMode         = .off
    @Published var notifyPlants:  Set<String>        = []
    @Published var lastStatus:    [String: String]   = [:]

    static let zones = ["Back Yard", "Side Yards", "Front Yard"]

    struct Override: Codable, Hashable {
        let low: Int
        let high: Int
    }

    enum NotifyMode: String, CaseIterable, Identifiable, Codable {
        case off, dry, wet, both
        var id: String { rawValue }
        var label: String {
            switch self {
            case .off:  return "Off"
            case .dry:  return "Only when too dry"
            case .wet:  return "Only when too wet"
            case .both: return "Both dry and too wet"
            }
        }
    }

    private let kOverrides    = "pw-overrides"
    private let kZones        = "pw-zone-overrides"
    private let kNotifyMode   = "pw-notify-mode"
    private let kNotifyPlants = "pw-notify-plants"
    private let kLastStatus   = "pw-last-status"

    private init() { load() }

    private func load() {
        let d = UserDefaults.standard
        if let data = d.data(forKey: kOverrides),
           let m = try? JSONDecoder().decode([String: Override].self, from: data) { overrides = m }
        if let data = d.data(forKey: kZones),
           let m = try? JSONDecoder().decode([String: String].self, from: data) { zoneOverrides = m }
        if let raw = d.string(forKey: kNotifyMode), let m = NotifyMode(rawValue: raw) { notifyMode = m }
        if let arr = d.array(forKey: kNotifyPlants) as? [String] { notifyPlants = Set(arr) }
        if let data = d.data(forKey: kLastStatus),
           let m = try? JSONDecoder().decode([String: String].self, from: data) { lastStatus = m }
    }

    private func saveOverrides()    { if let d = try? JSONEncoder().encode(overrides)     { UserDefaults.standard.set(d, forKey: kOverrides) } }
    private func saveZones()        { if let d = try? JSONEncoder().encode(zoneOverrides) { UserDefaults.standard.set(d, forKey: kZones) } }
    private func saveNotifyPlants() { UserDefaults.standard.set(Array(notifyPlants), forKey: kNotifyPlants) }
    private func saveLastStatus()   { if let d = try? JSONEncoder().encode(lastStatus) { UserDefaults.standard.set(d, forKey: kLastStatus) } }

    func setOverride(_ id: String, low: Int, high: Int) {
        overrides[id] = Override(low: low, high: high)
        saveOverrides()
    }
    func clearOverride(_ id: String) {
        overrides.removeValue(forKey: id)
        saveOverrides()
    }
    /// Move a plant to a different physical zone (or clear by passing its server default elsewhere).
    func setZone(_ id: String, _ zone: String) {
        zoneOverrides[id] = zone
        saveZones()
    }
    func clearZone(_ id: String) {
        zoneOverrides.removeValue(forKey: id)
        saveZones()
    }
    func setNotifyOn(_ id: String, _ on: Bool) {
        if on { notifyPlants.insert(id) } else { notifyPlants.remove(id) }
        saveNotifyPlants()
    }
    func setNotifyMode(_ mode: NotifyMode) {
        notifyMode = mode
        UserDefaults.standard.set(mode.rawValue, forKey: kNotifyMode)
    }
    func isNotifyOn(_ id: String) -> Bool { notifyPlants.contains(id) }

    /// Classify a moisture value against a low/high band.
    private func classify(_ m: Double, low: Int, high: Int) -> (Status, String, Bool) {
        if m < Double(low) {
            let gap = Double(low) - m
            return gap >= 12 ? (.veryDry, "VERY DRY", true) : (.dry, "Dry", true)
        }
        if m > Double(high) { return (.tooWet, "Too wet", false) }
        return (.good, "Good", false)
    }

    /// Apply local range + zone overrides to a reading.
    func applyOverride(_ r: Reading) -> Reading {
        let id = "\(r.zone)-\(r.channel)"
        var out = r

        // Zone override — move the plant to a different physical zone.
        if let z = zoneOverrides[id], z != (r.physicalZone ?? r.zone) {
            out.physicalZone = z
            out.customZone = true
        }

        // Range override — recompute status against the new band.
        if let o = overrides[id] {
            if let m = r.moisture {
                let (status, headline, _) = classify(m, low: o.low, high: o.high)
                out.idealLow = o.low; out.idealHigh = o.high
                out.status = status; out.headline = headline
                out.needsWater = (status == .dry || status == .veryDry)
                out.customRange = true
            } else {
                out.idealLow = o.low; out.idealHigh = o.high; out.customRange = true
            }
        }
        return out
    }

    /// Fire local notifications when a plant's status worsens, respecting prefs.
    func notifyIfChanged(_ readings: [Reading]) {
        guard notifyMode != .off else { return }
        Task {
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }

            var newStatus: [String: String] = [:]
            for r in readings {
                let id = "\(r.zone)-\(r.channel)"
                newStatus[id] = r.status.rawValue
                guard notifyPlants.contains(id) else { continue }
                let prev = lastStatus[id]
                guard prev != r.status.rawValue else { continue }

                let becameDry = (r.status == .dry || r.status == .veryDry) &&
                                (prev != Status.dry.rawValue && prev != Status.veryDry.rawValue)
                let becameWet = r.status == .tooWet && prev != Status.tooWet.rawValue
                let fireDry = (notifyMode == .dry || notifyMode == .both) && becameDry
                let fireWet = (notifyMode == .wet || notifyMode == .both) && becameWet
                guard fireDry || fireWet, let m = r.moisture else { continue }

                let bandText = (r.idealLow != nil && r.idealHigh != nil) ? " (ideal \(r.idealLow!)–\(r.idealHigh!)%)" : ""
                let content = UNMutableNotificationContent()
                content.title = "🌱 \(r.name)"
                content.body  = "\(r.headline) · \(Int(m))%\(bandText)"
                content.sound = .default
                let req = UNNotificationRequest(identifier: id,
                                                content: content,
                                                trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false))
                try? await UNUserNotificationCenter.current().add(req)
            }
            await MainActor.run {
                lastStatus = newStatus
                saveLastStatus()
            }
        }
    }

    /// Request notification authorization from the user.
    func requestAuthorization() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return false
        }
    }
}

// MARK: – Reading helpers for overrides

extension Reading {
    func withOverride(low: Int, high: Int, status: Status, headline: String) -> Reading {
        var r = self
        r.idealLow = low
        r.idealHigh = high
        r.status = status
        r.headline = headline
        r.needsWater = (status == .dry || status == .veryDry)
        r.customRange = true
        return r
    }
    func withRange(low: Int, high: Int, customRange: Bool) -> Reading {
        var r = self
        r.idealLow = low
        r.idealHigh = high
        r.customRange = customRange
        return r
    }
}
