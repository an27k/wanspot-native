import Observation
import SwiftUI
import WanspotKit

struct CalendarTabView: View {
    @Environment(AppModel.self) private var model
    @Environment(AppRouter.self) private var router
    @Environment(\.colorScheme) private var colorScheme

    @State private var store = CalendarTabStore()

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                WanspotBrandHeader()

                monthHeader
                calendarGrid
                selectedDaySection
            }
            .padding(.horizontal, WanspotMetrics.pagePadding)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .background(WanspotColors.paper)
        .accessibilityIdentifier("calendar.screen")
        .toolbar(.hidden, for: .navigationBar)
        .refreshable {
            await store.load(force: true)
        }
        .task {
            store.configure(repository: model.calendarRepository)
            await store.load()
        }
    }

    private var monthHeader: some View {
        HStack {
            Button {
                Task { await store.moveMonth(-1) }
            } label: {
                Image(systemName: "chevron.left")
                    .frame(width: 40, height: 40)
                    .background(WanspotColors.surface, in: Circle())
                    .overlay {
                        Circle().strokeBorder(WanspotColors.border)
                    }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("前の月")

            Spacer()

            Text(verbatim: "\(store.month.year)年\(store.month.month)月")
                .font(.title3.bold())
                .foregroundStyle(WanspotColors.textPrimary)

            Spacer()

            Button {
                Task { await store.moveMonth(1) }
            } label: {
                Image(systemName: "chevron.right")
                    .frame(width: 40, height: 40)
                    .background(WanspotColors.surface, in: Circle())
                    .overlay {
                        Circle().strokeBorder(WanspotColors.border)
                    }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("次の月")
        }
    }

    private var calendarGrid: some View {
        VStack(spacing: 4) {
            HStack(spacing: 0) {
                ForEach(
                    Array(CalendarRules.weekdaySymbols.enumerated()),
                    id: \.offset
                ) { index, symbol in
                    Text(symbol)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(weekdayHeaderColor(index))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                }
            }

            ForEach(
                Array(CalendarRules.monthGrid(store.month).enumerated()),
                id: \.offset
            ) { _, week in
                HStack(spacing: 2) {
                    ForEach(Array(week.enumerated()), id: \.offset) { _, day in
                        if let day {
                            calendarDay(day)
                        } else {
                            Color.clear
                                .frame(maxWidth: .infinity, minHeight: 52)
                        }
                    }
                }
            }
        }
        .padding(8)
        .background(WanspotColors.surface)
        .clipShape(.rect(cornerRadius: 18))
        .overlay {
            RoundedRectangle(cornerRadius: 18)
                .strokeBorder(WanspotColors.border)
        }
    }

    private func calendarDay(_ day: Int) -> some View {
        let key = CalendarRules.dateKey(
            year: store.month.year,
            month: store.month.month,
            day: day
        )
        let holiday = store.holidays[key]
        let tone = CalendarRules.dateTone(
            dateKey: key,
            todayKey: store.todayKey,
            holidayName: holiday
        )
        let selected = key == store.selectedDateKey
        let today = key == store.todayKey
        let count = min(store.eventsByDay[key]?.count ?? 0, 3)

        return Button {
            store.select(dateKey: key)
        } label: {
            VStack(spacing: 2) {
                Text("\(day)")
                    .font(.body.weight(today || selected ? .heavy : .semibold))
                    .foregroundStyle(dayColor(tone, selected: selected, today: today))
                    .frame(minHeight: 20)

                if let holiday {
                    Text(holiday)
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(
                            tone == .past
                                ? WanspotColors.textSecondary
                                : Color.red
                        )
                        .lineLimit(1)
                        .minimumScaleFactor(0.55)
                } else {
                    Text(" ")
                        .font(.system(size: 8))
                }

                HStack(spacing: 2) {
                    ForEach(0 ..< count, id: \.self) { _ in
                        Circle()
                            .fill(WanspotColors.primary)
                            .frame(width: 5, height: 5)
                    }
                }
                .frame(height: 5)
                .opacity(tone == .past ? 0.45 : 1)
            }
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(
                selected ? WanspotColors.tintWeak : Color.clear,
                in: RoundedRectangle(cornerRadius: 10)
            )
            .opacity(tone == .past ? 0.72 : 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(
            [
                "\(store.month.month)月\(day)日",
                holiday,
                count > 0 ? "イベント\(count)件以上" : nil,
            ].compactMap(\.self).joined(separator: "、")
        )
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    @ViewBuilder
    private var selectedDaySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(store.selectedDayTitle)
                .font(.title3.bold())
                .foregroundStyle(WanspotColors.textPrimary)

            if store.isLoading, store.events.isEmpty {
                HStack(spacing: 10) {
                    ProgressView()
                    Text("イベントを読み込み中…")
                        .font(.subheadline)
                        .foregroundStyle(WanspotColors.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 28)
            } else if let error = store.errorMessage {
                WanspotGlassCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Label(
                            "イベントを読み込めませんでした",
                            systemImage: "exclamationmark.triangle.fill"
                        )
                        .font(.headline)
                        .foregroundStyle(WanspotColors.error)
                        Text(error)
                            .font(.subheadline)
                            .foregroundStyle(WanspotColors.textSecondary)
                        Button("再試行") {
                            Task { await store.load(force: true) }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(WanspotColors.primary)
                    }
                }
            } else {
                if let holiday = store.selectedHoliday {
                    Text(holiday)
                        .font(.subheadline.bold())
                        .foregroundStyle(
                            store.selectedTone == .past
                                ? WanspotColors.textSecondary
                                : Color.red
                        )
                        .padding(.horizontal, 12)
                        .padding(.vertical, 9)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            WanspotColors.tintWeak,
                            in: RoundedRectangle(cornerRadius: 12)
                        )
                }

                if store.selectedEvents.isEmpty {
                    Text(
                        store.isInHorizon == false
                            ? "公開期間外の月です"
                            : "この日のイベントはありません"
                    )
                    .font(.subheadline)
                    .foregroundStyle(WanspotColors.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                } else {
                    ForEach(store.selectedEvents) { event in
                        eventCard(event)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func eventCard(_ event: CalendarEvent) -> some View {
        Button {
            Task {
                await model.calendarEventNavigationState.stash(event)
                router.navigate(to: .calendar(slug: event.slug))
            }
        } label: {
            HStack(spacing: 12) {
                WanspotRemoteImage(
                    url: ContentImageURL.resized(
                        event.thumbnailURL,
                        to: .thumbnail
                    ),
                    cornerRadius: 12,
                    accessibilityLabel: event.title
                )
                .frame(width: 72, height: 72)

                VStack(alignment: .leading, spacing: 5) {
                    Text(event.title)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(WanspotColors.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Text(store.metadataLine(for: event))
                        .font(.caption)
                        .foregroundStyle(WanspotColors.textSecondary)
                        .lineLimit(1)

                    HStack(spacing: 6) {
                        if let prefecture = CalendarRules.displayPrefecture(
                            for: event
                        ) {
                            Text(prefecture)
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(WanspotColors.primary)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(WanspotColors.tintWeak, in: Capsule())
                        }
                        CalendarPriceMark(level: event.priceLevel)
                        ForEach(event.tags.prefix(2)) { tag in
                            Text(tag.name)
                                .font(.caption2)
                                .foregroundStyle(WanspotColors.textSecondary)
                                .lineLimit(1)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "chevron.right")
                    .font(.caption.bold())
                    .foregroundStyle(WanspotColors.textSecondary)
            }
            .padding(10)
            .background(WanspotColors.surface)
            .clipShape(.rect(cornerRadius: 16))
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(WanspotColors.border)
            }
            .opacity(store.selectedTone == .past ? 0.58 : 1)
        }
        .buttonStyle(.plain)
    }

    private func weekdayHeaderColor(_ index: Int) -> Color {
        if index == 0 { return .red }
        if index == 6 { return .blue }
        return WanspotColors.textSecondary
    }

    private func dayColor(
        _ tone: CalendarDateTone,
        selected: Bool,
        today: Bool
    ) -> Color {
        if today { return WanspotColors.primary }
        if selected { return WanspotColors.textPrimary }
        return switch tone {
        case .past:
            WanspotColors.textSecondary.opacity(0.65)
        case .saturday:
            colorScheme == .dark ? Color(red: 0.47, green: 0.66, blue: 1) : .blue
        case .sundayOrHoliday:
            colorScheme == .dark ? Color(red: 1, green: 0.47, blue: 0.58) : .red
        case .weekday:
            WanspotColors.textSecondary
        }
    }
}

@MainActor
@Observable
private final class CalendarTabStore {
    private(set) var month: CalendarMonth
    private(set) var selectedDateKey: String
    private(set) var events: [CalendarEvent] = []
    private(set) var holidays: [String: String] = [:]
    private(set) var isInHorizon: Bool?
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    let todayKey: String

    private var repository: CalendarRepository?
    private var loadedMonth: CalendarMonth?

    init(now: Date = Date()) {
        let currentMonth = CalendarRules.month(containing: now)
        month = currentMonth
        todayKey = CalendarRules.dateKey(now)
        selectedDateKey = todayKey
        holidays = JapanHolidays.inMonth(currentMonth)
    }

    var eventsByDay: [String: [CalendarEvent]] {
        CalendarRules.eventsByDay(events)
    }

    var selectedEvents: [CalendarEvent] {
        eventsByDay[selectedDateKey] ?? []
    }

    var selectedHoliday: String? {
        holidays[selectedDateKey]
    }

    var selectedTone: CalendarDateTone {
        CalendarRules.dateTone(
            dateKey: selectedDateKey,
            todayKey: todayKey,
            holidayName: selectedHoliday
        )
    }

    var selectedDayTitle: String {
        let day = Int(selectedDateKey.suffix(2)) ?? 1
        let weekday = CalendarRules.weekdayIndex(for: selectedDateKey)
            .map { CalendarRules.weekdaySymbols[$0] } ?? ""
        return "\(month.month)月\(day)日（\(weekday)）のイベント"
    }

    func configure(repository: CalendarRepository?) {
        self.repository = repository
    }

    func select(dateKey: String) {
        selectedDateKey = dateKey
    }

    func moveMonth(_ delta: Int) async {
        month = month.adding(months: delta)
        events = []
        holidays = JapanHolidays.inMonth(month)
        selectedDateKey = CalendarRules.dateKey(
            year: month.year,
            month: month.month,
            day: 1
        )
        await load()
    }

    func load(force: Bool = false) async {
        guard let repository else {
            errorMessage = ContentRepositoryError.unavailable.localizedDescription
            return
        }
        if !force, loadedMonth == month { return }
        isLoading = true
        errorMessage = nil
        let requested = month
        defer { isLoading = false }
        do {
            let response = try await repository.fetchMonth(
                requested,
                force: force
            )
            guard requested == month else { return }
            events = response.events
            holidays = JapanHolidays.inMonth(requested).merging(
                response.metadata.holidays
            ) { _, server in server }
            isInHorizon = response.metadata.inHorizon
            loadedMonth = requested
        } catch {
            guard requested == month else { return }
            events = []
            holidays = JapanHolidays.inMonth(requested)
            isInHorizon = nil
            errorMessage = error.localizedDescription
        }
    }

    func metadataLine(for event: CalendarEvent) -> String {
        let time: String
        if let occurrence = CalendarRules.occurrence(
            in: event,
            on: selectedDateKey
        ) {
            time = occurrence.isAllDay
                ? "時刻未記載"
                : CalendarRules.timeLabel(occurrence.startsAt)
        } else {
            time = ""
        }
        return [
            time,
            event.venueName ?? event.regionName,
        ].compactMap { value in
            let value = value?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return value.isEmpty ? nil : value
        }.joined(separator: " · ")
    }
}

struct CalendarPriceMark: View {
    let level: Int?

    var body: some View {
        if let level {
            Text(level == 0 ? "無料" : String(repeating: "¥", count: min(4, max(1, level))))
                .font(.caption2.bold())
                .foregroundStyle(WanspotColors.primary)
        }
    }
}
