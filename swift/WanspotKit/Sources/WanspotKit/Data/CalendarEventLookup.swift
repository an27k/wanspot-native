import Foundation

/// slug か id しか手元に無い入口（チャットのイベントカード・`/events/[slug]` の
/// ディープリンク）から `CalendarEvent` 本体を復元するための共通経路。
///
/// カレンダー詳細は `CalendarEventNavigationState` が持つイベント本体を必要とする。
/// slug は単一イベント取得API `/api/calendar/events/by-slug/[slug]` で1リクエストで
/// 引けるため、「まず読み込み済みを見る → 外れたら単一イベントAPIを1回だけ引く」で済む。
/// id しか無い場合だけ、単一イベント取得の口が無いので月別APIの走査が残る。
public struct CalendarEventLookup: Sendable {
    /// id しか持たないカードの退避経路で、何ヶ月先まで月別APIを遡って探すか。
    /// 1ヶ月ぶん実測110〜175KBあるため、見つかった時点の早期終了つきで4ヶ月に留める
    public static let defaultMonthSpan = 4

    private let repository: CalendarRepository
    private let navigationState: CalendarEventNavigationState
    private let monthSpan: Int

    public init(
        repository: CalendarRepository,
        navigationState: CalendarEventNavigationState,
        monthSpan: Int = CalendarEventLookup.defaultMonthSpan
    ) {
        self.repository = repository
        self.navigationState = navigationState
        self.monthSpan = monthSpan
    }

    /// slug からイベント本体を得る。ナビゲーション状態（handoff / メモリ / stash）に
    /// 無ければ単一イベント取得APIを1回引く。カレンダータブから開いた通常経路では
    /// 最初の resolve で当たるため通信は発生しない。
    ///
    /// 単一イベントAPIはログイン済みなら月別APIの horizon（当月〜1年）に縛られないので、
    /// カレンダー未訪問でも・何ヶ月先でも・過去のイベントでも詳細が開く。
    /// チャットのイベントカードはログイン必須の経路なので、ここは常に解除される
    public func event(slug: String, now: Date = Date()) async -> CalendarEvent? {
        let slug = Self.normalized(slug)
        guard !slug.isEmpty else { return nil }
        if let resolved = await navigationState.resolve(slug: slug, now: now) {
            return resolved
        }

        let fetched: CalendarEvent?
        do {
            fetched = try await repository.fetchEvent(slug: slug)
        } catch {
            // 404（無い）も通信失敗も、呼び出し側の扱いは同じ空状態になる
            return nil
        }
        guard
            let fetched,
            // slug が空だと詳細のルートを組み立てられないため候補にしない
            !Self.normalized(fetched.slug).isEmpty
        else {
            return nil
        }
        // 同じイベントを2度取りに行かないようメモリに載せる（handoff が要る
        // 呼び出し側は別途 stash する）
        await navigationState.set(fetched)
        return fetched
    }

    /// id（UUID）からイベント本体を得る。slug を持たないチャットカード用の退避経路。
    /// id で単一イベントを引くAPIが無いため月別APIの走査が残っている
    /// （v7以降のサーバはカードに slug を載せるので通常経路では使われない）
    public func event(id: String, now: Date = Date()) async -> CalendarEvent? {
        let id = Self.normalized(id)
        guard !id.isEmpty else { return nil }
        if let cached = await navigationState.event(withID: id) {
            return cached
        }
        return await scan(from: now, matchingID: id)
    }

    private func scan(
        from now: Date,
        matchingID id: String
    ) async -> CalendarEvent? {
        let currentMonth = CalendarRules.month(containing: now)
        for offset in 0 ..< monthSpan {
            if Task.isCancelled { return nil }
            let month = currentMonth.adding(months: offset)
            guard let response = try? await repository.fetchMonth(month) else {
                // 1ヶ月ぶんの失敗で打ち切らない（他の月に居る可能性がある）
                continue
            }
            guard
                let event = response.events.first(where: {
                    Self.normalized($0.id) == id
                }),
                // slug が空だと詳細のルートを組み立てられないため候補にしない
                !Self.normalized(event.slug).isEmpty
            else {
                continue
            }
            await navigationState.set(event)
            return event
        }
        return nil
    }

    private static func normalized(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
